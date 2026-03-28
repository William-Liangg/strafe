"""
GitHub repository analysis service.
Fetches contributor activity (commits, PRs, reviews) and uses Claude
to infer expertise domains. Writes results to the expertise_map table.
"""
import asyncio
import json
import logging
from typing import Any

import httpx
from anthropic import AsyncAnthropic

from app.config import get_settings
from app.database import async_session
from app.models import ExpertiseMap
from sqlalchemy import delete

logger = logging.getLogger(__name__)

GITHUB_API_BASE = "https://api.github.com"


# ---------------------------------------------------------------------------
# GitHub API helpers
# ---------------------------------------------------------------------------


async def _github_get(
    client: httpx.AsyncClient,
    url: str,
    params: dict | None = None,
    retries: int = 4,
) -> Any:
    """GET a GitHub API URL with exponential backoff on rate limits."""
    for attempt in range(retries):
        try:
            response = await client.get(url, params=params)
            if response.status_code in (403, 429):
                retry_after = int(response.headers.get("Retry-After", 30 * (2 ** attempt)))
                wait = min(retry_after, 300)
                logger.warning(f"GitHub rate limit on {url}, waiting {wait}s")
                await asyncio.sleep(wait)
                continue
            if response.status_code == 404:
                return None
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as exc:
            if attempt == retries - 1:
                logger.error(f"GitHub request failed {url}: {exc}")
                return None
            await asyncio.sleep(2 ** attempt)
    return None


async def _paginate(
    client: httpx.AsyncClient,
    url: str,
    params: dict | None = None,
    max_pages: int = 5,
) -> list:
    """Fetch all pages of a list endpoint (handles both list and search responses)."""
    results: list = []
    base_params = {**(params or {}), "per_page": 100}

    for page in range(1, max_pages + 1):
        data = await _github_get(client, url, params={**base_params, "page": page})
        if not data:
            break
        if isinstance(data, list):
            results.extend(data)
            if len(data) < 100:
                break
        elif isinstance(data, dict) and "items" in data:
            results.extend(data["items"])
            if len(data["items"]) < 100:
                break
        else:
            break

    return results


# ---------------------------------------------------------------------------
# Claude domain inference
# ---------------------------------------------------------------------------


async def _infer_domains_with_claude(
    anthropic_client: AsyncAnthropic,
    login: str,
    commit_messages: list[str],
    files_touched: list[str],
    prs_opened: list[dict],
    prs_reviewed: list[str],
) -> list[dict]:
    """Call Claude to extract expertise domains from a contributor's activity."""
    files_block = "\n".join(f"  - {f}" for f in sorted(set(files_touched))[:60])
    commits_block = "\n".join(f"  - {m}" for m in commit_messages[:30])
    prs_block = "\n".join(
        f"  - \"{pr['title']}\": {', '.join(pr['files'][:6])}"
        for pr in prs_opened[:20]
    )
    reviews_block = "\n".join(f"  - {t}" for t in prs_reviewed[:20])

    prompt = f"""You are analyzing a GitHub contributor's activity to map their technical expertise.

Contributor login: {login}

Commit messages ({len(commit_messages)} total, showing up to 30):
{commits_block or "  (none)"}

Files touched across commits/PRs:
{files_block or "  (none)"}

PRs opened ({len(prs_opened)} total, showing up to 20):
{prs_block or "  (none)"}

PRs reviewed:
{reviews_block or "  (none)"}

Identify 3–6 distinct technical domains or components this contributor is expert in.
Use short, specific labels like "Database Models", "API Design", "Frontend Charts",
"DevOps / CI", "Authentication", "Background Tasks", "Data Pipeline", etc.
Base confidence on breadth and depth of activity: 1.0 = clear ownership, 0.5 = moderate involvement.

Return ONLY a JSON array, no markdown, no explanation:
[{{"domain": "...", "score": 0.0}}]"""

    try:
        response = await anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:]
        domains = json.loads(raw.strip())
        # Validate structure
        return [
            {"domain": str(d.get("domain", "")).strip(), "score": float(d.get("score", 0.5))}
            for d in domains
            if d.get("domain")
        ]
    except Exception as exc:
        logger.error(f"Claude domain inference failed for {login}: {exc}")
        return []


# ---------------------------------------------------------------------------
# Collect all unique contributors across every branch
# ---------------------------------------------------------------------------


async def _collect_all_contributors(
    client: httpx.AsyncClient,
    owner: str,
    repo: str,
) -> dict[str, dict]:
    """
    Returns {login: {"avatar_url": str, "commit_messages": list[str]}} for every
    human contributor found in any branch. Collecting commit messages here avoids
    a second author-filtered query (which fails when git email != GitHub account email).
    """
    contributor_map: dict[str, dict] = {}

    # Fetch all branches
    branches = await _paginate(
        client,
        f"{GITHUB_API_BASE}/repos/{owner}/{repo}/branches",
        max_pages=5,
    )
    branch_names = [b["name"] for b in branches if b.get("name")]
    logger.info(f"Found {len(branch_names)} branches: {branch_names}")

    for branch in branch_names:
        commits = await _paginate(
            client,
            f"{GITHUB_API_BASE}/repos/{owner}/{repo}/commits",
            params={"sha": branch},
            max_pages=3,
        )
        for commit in commits:
            author = commit.get("author")  # GitHub user object (not git author)
            if not author:
                continue
            login: str = author.get("login", "")
            avatar_url: str = author.get("avatar_url", "")
            if not login or login.endswith("[bot]"):
                continue
            message: str = commit.get("commit", {}).get("message", "").split("\n")[0]
            if login not in contributor_map:
                contributor_map[login] = {"avatar_url": avatar_url, "commit_messages": []}
            if message and message not in contributor_map[login]["commit_messages"]:
                contributor_map[login]["commit_messages"].append(message)

        await asyncio.sleep(0.1)  # gentle rate-limit cushion between branches

    return contributor_map


# ---------------------------------------------------------------------------
# Main analysis entry point
# ---------------------------------------------------------------------------


async def analyze_repo(owner: str, repo: str, github_token: str) -> dict:
    """
    Crawl the GitHub repo, infer expertise per contributor via Claude,
    and write results to the expertise_map table.

    Returns:
        {"contributors_analyzed": int, "domains_extracted": int}
    """
    settings = get_settings()
    anthropic_client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    contributors_analyzed = 0
    domains_extracted = 0

    async with httpx.AsyncClient(headers=headers, timeout=30.0) as client:
        # 1. Collect unique contributors across ALL branches (not just default/main)
        contributor_map = await _collect_all_contributors(client, owner, repo)

        if not contributor_map:
            logger.warning(f"No contributors found for {owner}/{repo}")
            return {"contributors_analyzed": 0, "domains_extracted": 0}

        logger.info(
            f"Found {len(contributor_map)} unique contributors across all branches "
            f"in {owner}/{repo}"
        )

        for login, info in contributor_map.items():
            try:
                await _analyze_one_contributor(
                    client=client,
                    anthropic_client=anthropic_client,
                    owner=owner,
                    repo=repo,
                    login=login,
                    avatar_url=info["avatar_url"],
                    known_commit_messages=info["commit_messages"],
                )
                contributors_analyzed += 1
                domains_extracted += await _count_domains_for(login)

            except Exception as exc:
                logger.error(f"Failed to analyze {login}: {exc}")
                continue

    return {
        "contributors_analyzed": contributors_analyzed,
        "domains_extracted": domains_extracted,
    }


async def _analyze_one_contributor(
    client: httpx.AsyncClient,
    anthropic_client: AsyncAnthropic,
    owner: str,
    repo: str,
    login: str,
    avatar_url: str,
    known_commit_messages: list[str] | None = None,
) -> None:
    """Fetch activity for one contributor, run Claude, write to DB."""
    logger.info(f"Analyzing contributor: {login}")

    # Use pre-collected commit messages (avoids email-mismatch issues with author filter)
    commit_messages = known_commit_messages or []

    # PRs opened by this contributor (via search to support filtering by author)
    pr_search = await _github_get(
        client,
        f"{GITHUB_API_BASE}/search/issues",
        params={
            "q": f"repo:{owner}/{repo} type:pr author:{login}",
            "per_page": 30,
            "sort": "updated",
        },
    )
    pr_items = (pr_search or {}).get("items", [])

    files_touched: list[str] = []
    prs_opened: list[dict] = []

    for pr in pr_items[:10]:
        pr_number = pr.get("number")
        pr_title = pr.get("title", "")
        if not pr_number:
            continue
        pr_files_raw = await _github_get(
            client,
            f"{GITHUB_API_BASE}/repos/{owner}/{repo}/pulls/{pr_number}/files",
            params={"per_page": 100},
        )
        file_paths = [f["filename"] for f in (pr_files_raw or [])]
        files_touched.extend(file_paths)
        prs_opened.append({"title": pr_title, "files": file_paths})
        await asyncio.sleep(0.15)  # gentle rate-limit cushion

    # PRs reviewed by this contributor
    review_search = await _github_get(
        client,
        f"{GITHUB_API_BASE}/search/issues",
        params={
            "q": f"repo:{owner}/{repo} type:pr reviewed-by:{login}",
            "per_page": 20,
        },
    )
    prs_reviewed = [
        item.get("title", "")
        for item in (review_search or {}).get("items", [])
    ]

    # Infer domains with Claude
    domains = await _infer_domains_with_claude(
        anthropic_client=anthropic_client,
        login=login,
        commit_messages=commit_messages,
        files_touched=files_touched,
        prs_opened=prs_opened,
        prs_reviewed=prs_reviewed,
    )

    if not domains:
        logger.warning(f"No domains inferred for {login} — using fallback")
        domains = [{"domain": "General Development", "score": 0.4}]

    # Write to expertise_map: delete existing GitHub-derived rows first
    async with async_session() as session:
        await session.execute(
            delete(ExpertiseMap).where(ExpertiseMap.github_login == login)
        )
        for entry in domains:
            domain = entry["domain"]
            score = min(1.0, max(0.0, entry["score"]))
            session.add(
                ExpertiseMap(
                    engineer_slack_id=f"github:{login}",
                    engineer_name=login,
                    service_or_domain=domain,
                    score=score,
                    pr_count=len(prs_opened),
                    github_login=login,
                    avatar_url=avatar_url,
                )
            )
        await session.commit()

    logger.info(f"Wrote {len(domains)} domains for {login}")


async def _count_domains_for(login: str) -> int:
    """Return how many expertise_map rows exist for a given github_login."""
    from sqlalchemy import select, func

    async with async_session() as session:
        result = await session.execute(
            select(func.count(ExpertiseMap.id)).where(
                ExpertiseMap.github_login == login
            )
        )
        return result.scalar() or 0

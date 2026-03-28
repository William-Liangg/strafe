"""
Expertise Map API
- GET  /expertise/graph         — full node/edge graph derived from expertise_map
- POST /expertise/sync          — trigger async GitHub re-analysis (Celery)
- GET  /expertise/sync/status   — check latest sync status
"""
import logging
from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ExpertiseMap, GithubSync

logger = logging.getLogger(__name__)
router = APIRouter()

EDGE_SCORE_THRESHOLD = 0.5  # minimum score for a domain to count toward an edge


# ---------------------------------------------------------------------------
# Pydantic response models
# ---------------------------------------------------------------------------


class ExpertiseDomainItem(BaseModel):
    domain: str
    score: float


class ExpertiseNodeResponse(BaseModel):
    id: str
    name: str
    github_login: str
    avatar_url: str | None
    expertise: list[ExpertiseDomainItem]
    top_domain: str


class ExpertiseEdgeResponse(BaseModel):
    source: str
    target: str
    shared_domains: list[str]
    weight: float


class ExpertiseGraphResponse(BaseModel):
    nodes: list[ExpertiseNodeResponse]
    edges: list[ExpertiseEdgeResponse]


class SyncStatusResponse(BaseModel):
    status: str  # "running" | "success" | "failed" | "never"
    task_id: str | None
    started_at: datetime | None
    synced_at: datetime | None
    contributors_analyzed: int
    domains_extracted: int
    error_message: str | None


class SyncTriggerResponse(BaseModel):
    task_id: str
    status: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_graph(rows: list[ExpertiseMap]) -> ExpertiseGraphResponse:
    """
    Build nodes and edges from raw expertise_map rows.
    Groups by github_login (falls back to engineer_name for seed data).
    """
    # Group entries by contributor identifier
    contributor_map: dict[str, list[ExpertiseMap]] = defaultdict(list)
    for row in rows:
        key = row.github_login or row.engineer_name
        contributor_map[key].append(row)

    # Build nodes
    nodes: list[ExpertiseNodeResponse] = []
    node_domains: dict[str, dict[str, float]] = {}  # login -> {domain: score}

    for key, entries in contributor_map.items():
        # Use latest avatar_url if available
        avatar = next((e.avatar_url for e in entries if e.avatar_url), None)
        github_login = next((e.github_login for e in entries if e.github_login), key)

        expertise = sorted(
            [ExpertiseDomainItem(domain=e.service_or_domain, score=e.score) for e in entries],
            key=lambda x: x.score,
            reverse=True,
        )
        top_domain = expertise[0].domain if expertise else "General"

        nodes.append(
            ExpertiseNodeResponse(
                id=key,
                name=github_login,
                github_login=github_login,
                avatar_url=avatar,
                expertise=expertise,
                top_domain=top_domain,
            )
        )

        # Build domain->score map for edge computation
        node_domains[key] = {
            e.service_or_domain: e.score
            for e in entries
            if e.score >= EDGE_SCORE_THRESHOLD
        }

    # Build edges between contributors who share domains
    edges: list[ExpertiseEdgeResponse] = []
    node_keys = list(contributor_map.keys())

    for i in range(len(node_keys)):
        for j in range(i + 1, len(node_keys)):
            a, b = node_keys[i], node_keys[j]
            domains_a = node_domains.get(a, {})
            domains_b = node_domains.get(b, {})

            shared = set(domains_a.keys()) & set(domains_b.keys())
            if not shared:
                continue

            # Edge weight = average of both scores across all shared domains
            weight = sum(
                (domains_a[d] + domains_b[d]) / 2 for d in shared
            ) / len(shared)

            edges.append(
                ExpertiseEdgeResponse(
                    source=a,
                    target=b,
                    shared_domains=sorted(shared),
                    weight=round(weight, 3),
                )
            )

    return ExpertiseGraphResponse(nodes=nodes, edges=edges)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/graph", response_model=ExpertiseGraphResponse)
async def get_expertise_graph(db: AsyncSession = Depends(get_db)):
    """
    Returns the full expertise graph: nodes (contributors) + edges (shared domains).
    """
    result = await db.execute(
        select(ExpertiseMap).where(ExpertiseMap.github_login.isnot(None))
    )
    rows = result.scalars().all()
    return _build_graph(rows)


@router.post("/sync", response_model=SyncTriggerResponse)
async def trigger_sync(db: AsyncSession = Depends(get_db)):
    """
    Trigger a full GitHub re-analysis as a Celery background task.
    Returns immediately with task_id; poll /expertise/sync/status for progress.
    """
    from app.workers.tasks import github_sync_task

    # Dispatch the Celery task
    task = github_sync_task.delay()

    # Record the sync attempt in DB (get_db commits on response)
    sync_record = GithubSync(
        celery_task_id=task.id,
        status="running",
    )
    db.add(sync_record)

    logger.info(f"GitHub sync triggered, task_id={task.id}")
    return SyncTriggerResponse(task_id=task.id, status="running")


@router.get("/sync/status", response_model=SyncStatusResponse)
async def get_sync_status(db: AsyncSession = Depends(get_db)):
    """
    Returns the status of the most recent GitHub sync.
    """
    result = await db.execute(
        select(GithubSync).order_by(GithubSync.started_at.desc()).limit(1)
    )
    latest = result.scalar_one_or_none()

    if not latest:
        return SyncStatusResponse(
            status="never",
            task_id=None,
            started_at=None,
            synced_at=None,
            contributors_analyzed=0,
            domains_extracted=0,
            error_message=None,
        )

    # If status is still "running", check Celery for the real state
    if latest.status == "running" and latest.celery_task_id:
        try:
            from app.workers.celery_app import celery_app
            async_result = celery_app.AsyncResult(latest.celery_task_id)
            if async_result.state in ("SUCCESS", "FAILURE"):
                latest.status = "success" if async_result.state == "SUCCESS" else "failed"
                if async_result.state == "FAILURE":
                    latest.error_message = str(async_result.result)
                # get_db commits on response
        except Exception:
            pass  # Don't fail the status check if Celery is unavailable

    return SyncStatusResponse(
        status=latest.status,
        task_id=latest.celery_task_id,
        started_at=latest.started_at,
        synced_at=latest.synced_at,
        contributors_analyzed=latest.contributors_analyzed,
        domains_extracted=latest.domains_extracted,
        error_message=latest.error_message,
    )

import json
import time
import logging
from anthropic import Anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import async_session
from app.models import ExpertiseMap

logger = logging.getLogger(__name__)

TICKET_GENERATION_PROMPT = """You are an expert at converting Slack conversations into well-structured Jira tickets.

Analyze the following Slack thread and generate a complete Jira ticket draft.

## Rules:
1. Title: Max 80 characters, imperative verb form (e.g., "Add margin fields to /v2/quotes endpoint")
2. Description: Full markdown with context including:
   - What was requested
   - Who requested it and why it matters
   - Any deadlines or urgency mentioned
   - Link back to the Slack thread
3. Priority: Based on urgency signals
   - critical: "blocking", "production down", "P0"
   - high: "urgent", "ASAP", "EOD", "deal closing", "tomorrow", deadlines within 24-48 hours
   - medium: Important but not time-critical, deadlines within a week
   - low: Nice-to-have, no deadline mentioned
4. Labels: Array containing applicable labels
   - Always include "adhoc" (this came from Slack, not sprint planning)
   - Add "bug" if describing broken behavior, errors, or regressions
   - Add "feature" if requesting new functionality or enhancements
5. Story points: Fibonacci only (1, 2, 3, 5, 8) - estimate based on complexity
   - 1: Trivial config change or one-liner
   - 2: Small isolated change
   - 3: Standard task with some complexity
   - 5: Significant work touching multiple files/services
   - 8: Large feature or complex investigation
6. Assignee: Suggest the best engineer based on the expertise map provided

## Expertise Map (engineers and their domains):
{expertise_map}

## Slack Thread:
Channel: #{channel_name}
Thread URL: {thread_url}

{thread_content}

---

Return ONLY valid JSON with no preamble, no markdown fences, no explanation:
{{
  "title": "string, max 80 chars",
  "description": "string, full markdown description",
  "priority": "low|medium|high|critical",
  "labels": ["adhoc", "..."],
  "story_points": 1|2|3|5|8,
  "suggested_assignee_slack_id": "string or null if no good match",
  "suggested_assignee_name": "string or null",
  "assignee_reason": "string explaining why this person, or null"
}}"""

RETRY_PROMPT = """Your previous response was not valid JSON. Please return ONLY a valid JSON object with no preamble, no markdown code fences, and no explanation text.

Required format:
{{
  "title": "string",
  "description": "string",
  "priority": "low|medium|high|critical",
  "labels": ["adhoc"],
  "story_points": 3,
  "suggested_assignee_slack_id": "string or null",
  "suggested_assignee_name": "string or null",
  "assignee_reason": "string or null"
}}

Previous invalid response:
{previous_response}

Original request was to generate a ticket for this Slack thread:
{thread_content}"""


class TicketGenerator:
    def __init__(self):
        settings = get_settings()
        self.client = Anthropic(api_key=settings.anthropic_api_key)

    async def get_expertise_map_text(self) -> str:
        """Fetch expertise map from database and format as text."""
        async with async_session() as session:
            result = await session.execute(
                select(ExpertiseMap)
                .where(ExpertiseMap.github_login.isnot(None))
                .order_by(ExpertiseMap.score.desc())
            )
            experts = result.scalars().all()

            if not experts:
                return "No expertise data available - suggest assignee based on thread context."

            lines = []
            for expert in experts:
                lines.append(
                    f"- {expert.engineer_name} ({expert.engineer_slack_id}): "
                    f"{expert.service_or_domain} - {expert.pr_count} PRs, score {expert.score:.1f}"
                )
            return "\n".join(lines)

    def _call_claude(self, prompt: str) -> tuple[str, dict]:
        """Call Claude and return response text plus usage stats."""
        start_time = time.time()

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )

        latency_ms = (time.time() - start_time) * 1000
        usage = {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
            "latency_ms": round(latency_ms, 2),
        }

        logger.info(
            f"Claude ticket generation: {usage['input_tokens']} input tokens, "
            f"{usage['output_tokens']} output tokens, {usage['latency_ms']}ms"
        )

        return response.content[0].text, usage

    def _parse_json_response(self, response_text: str) -> dict | None:
        """Try to parse JSON from response, handling common issues."""
        # Try direct parse first
        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            pass

        # Try to extract JSON from markdown code blocks
        import re
        json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", response_text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

        # Try to find raw JSON object
        json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        return None

    async def generate_ticket(
        self,
        thread_content: str,
        channel_name: str,
        thread_url: str,
        tagged_slack_id: str | None = None,
        tagged_name: str | None = None,
    ) -> dict:
        """Generate a ticket draft from a Slack thread."""
        expertise_map = await self.get_expertise_map_text()

        prompt = TICKET_GENERATION_PROMPT.format(
            expertise_map=expertise_map,
            channel_name=channel_name,
            thread_url=thread_url,
            thread_content=thread_content,
        )

        response_text, usage = self._call_claude(prompt)
        result = self._parse_json_response(response_text)

        # Retry once if parsing failed
        if result is None:
            logger.warning("First Claude response was not valid JSON, retrying...")
            retry_prompt = RETRY_PROMPT.format(
                previous_response=response_text[:500],
                thread_content=thread_content[:1000],
            )
            response_text, retry_usage = self._call_claude(retry_prompt)
            result = self._parse_json_response(response_text)

        # If still failed, return fallback
        if result is None:
            logger.error("Claude failed to return valid JSON after retry")
            return {
                "title": "Review required",
                "description": f"Could not auto-generate ticket. Original thread:\n\n{thread_content}",
                "priority": "medium",
                "labels": ["adhoc"],
                "story_points": 3,
                "suggested_assignee_slack_id": None,
                "suggested_assignee_name": None,
                "assignee_reason": None,
                "_parse_error": True,
            }

        # Validate and sanitize response
        result = self._validate_ticket_data(result)

        # Override Claude's assignee suggestion if a specific user was tagged
        if tagged_slack_id:
            result["suggested_assignee_slack_id"] = tagged_slack_id
            result["suggested_assignee_name"] = tagged_name
            result["assignee_reason"] = f"Explicitly tagged in the Slack thread"

        return result

    def _validate_ticket_data(self, data: dict) -> dict:
        """Validate and fix ticket data to match expected schema."""
        # Ensure title is max 80 chars
        if "title" in data and len(data["title"]) > 80:
            data["title"] = data["title"][:77] + "..."

        # Ensure priority is valid
        valid_priorities = ["low", "medium", "high", "critical"]
        if data.get("priority") not in valid_priorities:
            data["priority"] = "medium"

        # Ensure story_points is fibonacci
        valid_points = [1, 2, 3, 5, 8]
        if data.get("story_points") not in valid_points:
            # Map to nearest fibonacci
            sp = data.get("story_points", 3)
            if isinstance(sp, int):
                if sp <= 1:
                    data["story_points"] = 1
                elif sp <= 2:
                    data["story_points"] = 2
                elif sp <= 3:
                    data["story_points"] = 3
                elif sp <= 6:
                    data["story_points"] = 5
                else:
                    data["story_points"] = 8
            else:
                data["story_points"] = 3

        # Ensure labels is a list with at least "adhoc"
        if not isinstance(data.get("labels"), list):
            data["labels"] = ["adhoc"]
        elif "adhoc" not in data["labels"]:
            data["labels"].insert(0, "adhoc")

        # Ensure description exists
        if not data.get("description"):
            data["description"] = "No description generated."

        return data


# Singleton instance
_generator: TicketGenerator | None = None


def get_ticket_generator() -> TicketGenerator:
    global _generator
    if _generator is None:
        _generator = TicketGenerator()
    return _generator

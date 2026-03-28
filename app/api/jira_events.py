import logging
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Request, HTTPException

from sqlalchemy import select, func
from app.database import async_session
from app.models import Ticket, Sprint, SprintState, ExpertiseMap

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/jira")
async def jira_webhook(request: Request):
    """Handle Jira webhook events."""
    try:
        payload = await request.json()
    except Exception as e:
        logger.error(f"Failed to parse Jira webhook payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    webhook_event = payload.get("webhookEvent", "")
    logger.info(f"Received Jira webhook: {webhook_event}")

    if webhook_event == "jira:issue_created":
        await handle_issue_created(payload)
    elif webhook_event == "jira:issue_updated":
        await handle_issue_updated(payload)
    elif webhook_event == "sprint_started":
        await handle_sprint_started(payload)
    elif webhook_event == "sprint_closed":
        await handle_sprint_completed(payload)

    return {"ok": True}


async def handle_issue_created(payload: dict):
    """Handle new issue created in Jira."""
    issue = payload.get("issue", {})
    issue_key = issue.get("key")
    fields = issue.get("fields", {})

    if not issue_key:
        logger.warning("Issue created webhook missing issue key")
        return

    async with async_session() as session:
        # Check if this ticket already exists (created by Strafe)
        existing = await session.execute(
            select(Ticket).where(Ticket.jira_ticket_id == issue_key)
        )
        if existing.scalar_one_or_none():
            logger.info(f"Issue {issue_key} already exists in Strafe (adhoc), skipping")
            return

        # This is a planned ticket - created directly in Jira
        logger.info(f"Recording planned ticket: {issue_key}")

        # Extract fields
        title = fields.get("summary", "Untitled")
        description = fields.get("description", "")
        if isinstance(description, dict):
            # Jira Cloud uses Atlassian Document Format
            description = _extract_text_from_adf(description)

        priority_name = fields.get("priority", {}).get("name", "Medium")
        priority_map = {"Highest": "critical", "High": "high", "Medium": "medium", "Low": "low", "Lowest": "low"}
        priority = priority_map.get(priority_name, "medium")

        labels = fields.get("labels", [])
        if "planned" not in labels:
            labels.append("planned")

        # Story points - check common custom field IDs
        story_points = 3
        for field_id in ["customfield_10016", "customfield_10026", "customfield_10024"]:
            if fields.get(field_id):
                try:
                    story_points = int(fields.get(field_id))
                except (ValueError, TypeError):
                    pass
                break

        # Assignee
        assignee = fields.get("assignee", {}) or {}
        assignee_name = assignee.get("displayName")
        assignee_account_id = assignee.get("accountId")

        # Try to map Jira account to Slack ID
        suggested_assignee_slack_id = None
        if assignee_account_id:
            expert_result = await session.execute(
                select(ExpertiseMap).where(
                    ExpertiseMap.engineer_name == assignee_name
                ).limit(1)
            )
            expert = expert_result.scalar_one_or_none()
            if expert:
                suggested_assignee_slack_id = expert.engineer_slack_id

        # Extract sprint
        sprint_id = None
        sprint_data = fields.get("sprint") or fields.get("customfield_10020")
        if sprint_data:
            if isinstance(sprint_data, list) and sprint_data:
                sprint_data = sprint_data[0]
            if isinstance(sprint_data, dict):
                jira_sprint_id = sprint_data.get("id")
                if jira_sprint_id:
                    sprint_id = await _get_or_create_sprint(session, sprint_data)

        # Get Jira base URL from config
        from app.config import get_settings
        settings = get_settings()
        jira_url = f"{settings.jira_base_url}/browse/{issue_key}"

        ticket = Ticket(
            jira_ticket_id=issue_key,
            jira_ticket_url=jira_url,
            title=title[:255] if len(title) > 255 else title,
            description=description or "No description provided",
            priority=priority,
            labels=labels,
            story_points=story_points,
            suggested_assignee_slack_id=suggested_assignee_slack_id,
            suggested_assignee_name=assignee_name,
            origin_type="planned",
            trigger_mode="automatic",
            status="created",
            sprint_id=sprint_id,
        )
        session.add(ticket)
        await session.commit()

        logger.info(f"Created planned ticket record for {issue_key}")


async def handle_issue_updated(payload: dict):
    """Handle issue updated in Jira - track completion."""
    issue = payload.get("issue", {})
    issue_key = issue.get("key")
    fields = issue.get("fields", {})
    changelog = payload.get("changelog", {})

    if not issue_key:
        return

    # Check if status changed to Done
    status_changed_to_done = False
    for item in changelog.get("items", []):
        if item.get("field") == "status" and item.get("toString", "").lower() == "done":
            status_changed_to_done = True
            break

    if not status_changed_to_done:
        return

    async with async_session() as session:
        result = await session.execute(
            select(Ticket).where(Ticket.jira_ticket_id == issue_key)
        )
        ticket = result.scalar_one_or_none()

        if ticket:
            ticket.completed_at = datetime.now(timezone.utc)
            await session.commit()
            logger.info(f"Marked ticket {issue_key} as completed")

            # TODO: Enqueue RCA generation (Feature 7)
            logger.info(f"RCA queued for {ticket.id}")


async def handle_sprint_started(payload: dict):
    """Handle sprint started event."""
    sprint_data = payload.get("sprint", {})
    if not sprint_data:
        return

    async with async_session() as session:
        await _get_or_create_sprint(session, sprint_data, state="active")
        await session.commit()

    logger.info(f"Sprint started: {sprint_data.get('name')}")


async def handle_sprint_completed(payload: dict):
    """Handle sprint completed event - compute final metrics."""
    sprint_data = payload.get("sprint", {})
    jira_sprint_id = sprint_data.get("id")

    if not jira_sprint_id:
        return

    async with async_session() as session:
        result = await session.execute(
            select(Sprint).where(Sprint.jira_sprint_id == jira_sprint_id)
        )
        sprint = result.scalar_one_or_none()

        if not sprint:
            logger.warning(f"Sprint {jira_sprint_id} not found")
            return

        # Update sprint state
        sprint.state = SprintState.CLOSED
        sprint.end_date = datetime.now(timezone.utc)

        # Compute metrics
        adhoc_result = await session.execute(
            select(
                func.count(Ticket.id),
                func.coalesce(func.sum(Ticket.story_points), 0)
            ).where(
                Ticket.sprint_id == sprint.id,
                Ticket.origin_type == "adhoc"
            )
        )
        adhoc_count, adhoc_points = adhoc_result.one()

        planned_result = await session.execute(
            select(
                func.count(Ticket.id),
                func.coalesce(func.sum(Ticket.story_points), 0)
            ).where(
                Ticket.sprint_id == sprint.id,
                Ticket.origin_type == "planned"
            )
        )
        planned_count, planned_points = planned_result.one()

        total = adhoc_count + planned_count
        adhoc_percentage = (adhoc_count / total * 100) if total > 0 else 0.0

        # Find top source channel
        channel_result = await session.execute(
            select(
                Ticket.source_channel_name,
                func.count(Ticket.id).label("count")
            ).where(
                Ticket.sprint_id == sprint.id,
                Ticket.origin_type == "adhoc",
                Ticket.source_channel_name.isnot(None)
            ).group_by(Ticket.source_channel_name)
            .order_by(func.count(Ticket.id).desc())
            .limit(1)
        )
        top_channel_row = channel_result.first()
        top_source_channel = top_channel_row[0] if top_channel_row else None

        # Update sprint with computed metrics
        sprint.adhoc_count = adhoc_count
        sprint.planned_count = planned_count
        sprint.adhoc_percentage = round(adhoc_percentage, 1)
        sprint.top_source_channel = top_source_channel
        sprint.total_story_points_adhoc = adhoc_points
        sprint.total_story_points_planned = planned_points

        await session.commit()

        logger.info(
            f"Sprint {sprint.name} completed: {adhoc_count} adhoc ({adhoc_percentage:.1f}%), "
            f"{planned_count} planned"
        )


async def _get_or_create_sprint(session, sprint_data: dict, state: str = None) -> UUID | None:
    """Get or create a sprint record from Jira sprint data."""
    jira_sprint_id = sprint_data.get("id")
    if not jira_sprint_id:
        return None

    result = await session.execute(
        select(Sprint).where(Sprint.jira_sprint_id == jira_sprint_id)
    )
    sprint = result.scalar_one_or_none()

    if sprint:
        if state:
            sprint.state = state
        return sprint.id

    # Parse dates
    start_date = None
    end_date = None
    if sprint_data.get("startDate"):
        try:
            start_date = datetime.fromisoformat(sprint_data["startDate"].replace("Z", "+00:00"))
        except (ValueError, TypeError):
            pass
    if sprint_data.get("endDate"):
        try:
            end_date = datetime.fromisoformat(sprint_data["endDate"].replace("Z", "+00:00"))
        except (ValueError, TypeError):
            pass

    # Determine state
    sprint_state = state or sprint_data.get("state", "future")
    if sprint_state not in ("active", "closed", "future"):
        sprint_state = "future"

    sprint = Sprint(
        jira_sprint_id=jira_sprint_id,
        name=sprint_data.get("name", f"Sprint {jira_sprint_id}"),
        state=sprint_state,
        start_date=start_date,
        end_date=end_date,
    )
    session.add(sprint)
    await session.flush()

    logger.info(f"Created sprint record: {sprint.name} (Jira ID: {jira_sprint_id})")
    return sprint.id


def _extract_text_from_adf(adf: dict) -> str:
    """Extract plain text from Atlassian Document Format."""
    if not isinstance(adf, dict):
        return str(adf) if adf else ""

    texts = []

    def extract(node):
        if isinstance(node, dict):
            if node.get("type") == "text":
                texts.append(node.get("text", ""))
            for child in node.get("content", []):
                extract(child)
        elif isinstance(node, list):
            for item in node:
                extract(item)

    extract(adf)
    return " ".join(texts)

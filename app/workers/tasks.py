import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID

from app.workers.celery_app import celery_app
from app.services.live_slack_sync import analyze_and_generate_thread, scan_monitored_slack_threads
from app.services.thread_analyzer import analyze_thread

logger = logging.getLogger(__name__)


def run_async(coro):
    """Helper to run async code in sync Celery tasks."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_kwargs={"max_retries": 3},
)
def analyze_thread_task(self, channel_id: str, thread_ts: str, workspace_id: str):
    """
    Celery task to analyze a Slack thread.
    Retries automatically on failure with exponential backoff.
    """
    result = run_async(analyze_thread(channel_id, thread_ts, workspace_id))

    if result:
        classification = result.get("classification", "unknown")
        confidence = result.get("confidence", 0)
        logger.info(
            f"Thread {thread_ts} in {channel_id} classified as '{classification}' "
            f"with {confidence:.0%} confidence"
        )

    return result


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_kwargs={"max_retries": 3},
)
def generate_ticket_task(
    self,
    channel_id: str,
    thread_ts: str,
    channel_name: str,
    trigger_mode: str,
    detected_task_id: str | None = None,
    thread_content: str | None = None,
):
    """
    Celery task to generate a ticket draft from a Slack thread.
    """
    from app.services.slack_client import get_slack_client
    from app.services.ticket_generator import get_ticket_generator
    from app.database import async_session
    from app.models import Ticket, TriggerMode
    from sqlalchemy import select

    async def _generate():
        slack_client = get_slack_client()
        generator = get_ticket_generator()

        # Get thread content if not provided
        if not thread_content:
            messages = slack_client.get_thread_messages(channel_id, thread_ts)
            if not messages:
                logger.error(f"Could not fetch thread {thread_ts} in {channel_id}")
                return None
            content = slack_client.format_thread_for_analysis(messages)
        else:
            content = thread_content

        # Get thread URL
        thread_url = slack_client.get_permalink(channel_id, thread_ts)
        if not thread_url:
            thread_url = f"slack://channel?id={channel_id}&message={thread_ts}"

        # Generate ticket with Claude
        ticket_data = await generator.generate_ticket(
            thread_content=content,
            channel_name=channel_name,
            thread_url=thread_url,
        )

        # Map trigger mode string to enum
        trigger_mode_enum = TriggerMode(trigger_mode)

        # Save ticket to database
        async with async_session() as session:
            ticket = Ticket(
                detected_task_id=UUID(detected_task_id) if detected_task_id else None,
                title=ticket_data["title"],
                description=ticket_data["description"],
                priority=ticket_data["priority"],
                labels=ticket_data["labels"],
                story_points=ticket_data["story_points"],
                suggested_assignee_slack_id=ticket_data.get("suggested_assignee_slack_id"),
                suggested_assignee_name=ticket_data.get("suggested_assignee_name"),
                assignee_reason=ticket_data.get("assignee_reason"),
                source_thread_url=thread_url,
                source_channel_id=channel_id,
                source_channel_name=channel_name,
                source_thread_ts=thread_ts,
                trigger_mode=trigger_mode_enum,
                status="draft",
            )
            session.add(ticket)
            await session.commit()
            await session.refresh(ticket)

            logger.info(f"Generated ticket draft: {ticket.title} (ID: {ticket.id})")
            return str(ticket.id)

    return run_async(_generate())


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_kwargs={"max_retries": 3},
)
def analyze_and_generate_ticket_task(
    self,
    channel_id: str,
    thread_ts: str,
    workspace_id: str,
    channel_name: str,
):
    """Analyze a Slack thread and create a ticket or dismissal decision."""
    return run_async(
        analyze_and_generate_thread(
            channel_id=channel_id,
            thread_ts=thread_ts,
            workspace_id=workspace_id,
            channel_name=channel_name,
        )
    )


def _build_dismissed_reasoning(
    classification: str,
    confidence: float,
    sensitivity_threshold: float,
    channel_name: str,
) -> str:
    """Build human-readable reasoning for dismissed threads."""
    if classification in ("question", "conversation"):
        return (
            f"Thread classified as a {classification} with {confidence:.0%} confidence, "
            f"below the {sensitivity_threshold:.0%} detection threshold for #{channel_name}. "
            f"No ticket generated."
        )
    else:
        return (
            f"Thread classified as '{classification}' with {confidence:.0%} confidence, "
            f"which does not meet the {sensitivity_threshold:.0%} threshold for #{channel_name}. "
            f"No action taken."
        )


def _build_auto_assigned_reasoning(
    assignee_name: str | None,
    assignee_reason: str | None,
    confidence: float,
    auto_approve_threshold: float,
    story_points: int,
    auto_approve_max_points: int,
) -> str:
    """Build human-readable reasoning for auto-assigned tickets."""
    assignee_part = f"Assigned to {assignee_name}" if assignee_name else "Auto-assigned"
    reason_part = f" based on {assignee_reason}" if assignee_reason else ""

    return (
        f"{assignee_part}{reason_part}. "
        f"Confidence {confidence:.0%} exceeded the {auto_approve_threshold:.0%} auto-approve threshold "
        f"and {story_points} story points is within the {auto_approve_max_points}-point auto-approve limit."
    )


def _build_flagged_reasoning(
    assignee_name: str | None,
    confidence: float,
    auto_approve_threshold: float,
    story_points: int,
    auto_approve_max_points: int,
) -> str:
    """Build human-readable reasoning for flagged tickets."""
    reasons = []

    if story_points > auto_approve_max_points:
        reasons.append(
            f"estimated at {story_points} story points which exceeds "
            f"the auto-approve limit of {auto_approve_max_points}"
        )

    if confidence < auto_approve_threshold:
        reasons.append(
            f"confidence of {confidence:.0%} is below "
            f"the {auto_approve_threshold:.0%} auto-approve threshold"
        )

    reason_text = " and ".join(reasons) if reasons else "does not meet auto-approve criteria"
    assignee_part = f"Suggested assignee is {assignee_name}." if assignee_name else ""

    return f"Flagged for manager review — {reason_text}. {assignee_part}".strip()


def _send_assignee_dm(
    slack_client,
    assignee_slack_id: str | None,
    title: str,
    jira_key: str,
    jira_url: str,
    priority: str,
    story_points: int,
    channel_name: str,
) -> None:
    """Send DM to assignee about new ticket."""
    if not assignee_slack_id:
        logger.warning("No assignee Slack ID, skipping assignee DM")
        return

    message = (
        f":robot_face: Strafe assigned you a new ticket: *{title}* ({jira_key})\n"
        f"Priority: {priority} · {story_points} pts\n"
        f"Detected from #{channel_name}\n"
        f"View in Jira: {jira_url}"
    )

    try:
        slack_client.send_dm(assignee_slack_id, message)
        logger.info(f"Sent assignee DM to {assignee_slack_id}")
    except Exception as e:
        logger.error(f"Failed to send assignee DM: {e}")


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_kwargs={"max_retries": 2},
)
def scan_live_slack_task(self, scan_id: str, since_hours: int):
    """Backfill recent Slack threads from monitored channels."""
    from app.database import async_session
    from app.models import SlackScan

    async def _scan():
        async with async_session() as session:
            scan = await session.get(SlackScan, UUID(scan_id))
            if not scan:
                raise ValueError(f"Slack scan {scan_id} not found")
            scan.status = "running"
            await session.commit()

        try:
            stats = await scan_monitored_slack_threads(since_hours)
            async with async_session() as session:
                scan = await session.get(SlackScan, UUID(scan_id))
                if scan:
                    scan.status = "success"
                    scan.channels_scanned = stats["channels_scanned"]
                    scan.threads_found = stats["threads_found"]
                    scan.tickets_generated = stats["tickets_generated"]
                    scan.completed_at = datetime.now(timezone.utc)
                    await session.commit()
            return stats
        except Exception as exc:
            async with async_session() as session:
                scan = await session.get(SlackScan, UUID(scan_id))
                if scan:
                    scan.status = "failed"
                    scan.error_message = str(exc)
                    scan.completed_at = datetime.now(timezone.utc)
                    await session.commit()
            raise

    return run_async(_scan())


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_kwargs={"max_retries": 2},
)
def github_sync_task(self):
    """
    Celery task: crawl the configured GitHub repo, infer expertise domains
    per contributor with Claude, and write results to the expertise_map table.
    Updates the corresponding GithubSync record on completion or failure.
    """
    from app.config import get_settings
    from app.services.github_analyzer import analyze_repo
    from app.database import async_session
    from app.models import GithubSync
    from sqlalchemy import select

    settings = get_settings()

    async def _run():
        # Find the running GithubSync record for this task
        async with async_session() as session:
            result = await session.execute(
                select(GithubSync)
                .where(GithubSync.celery_task_id == self.request.id)
                .limit(1)
            )
            sync_record = result.scalar_one_or_none()

        owner = settings.github_repo_owner
        repo = settings.github_repo_name
        token = settings.github_token

        if not owner or not repo or not token:
            error_msg = (
                "GitHub analysis requires GITHUB_REPO_OWNER, GITHUB_REPO_NAME, "
                "and GITHUB_TOKEN in .env"
            )
            logger.error(error_msg)
            if sync_record:
                async with async_session() as session:
                    rec = await session.get(type(sync_record), sync_record.id)
                    if rec:
                        rec.status = "failed"
                        rec.error_message = error_msg
                        rec.synced_at = datetime.now(timezone.utc)
                        await session.commit()
            return {"error": error_msg}

        try:
            stats = await analyze_repo(owner=owner, repo=repo, github_token=token)

            if sync_record:
                async with async_session() as session:
                    rec = await session.get(type(sync_record), sync_record.id)
                    if rec:
                        rec.status = "success"
                        rec.contributors_analyzed = stats["contributors_analyzed"]
                        rec.domains_extracted = stats["domains_extracted"]
                        rec.synced_at = datetime.now(timezone.utc)
                        await session.commit()

            logger.info(
                f"GitHub sync complete: {stats['contributors_analyzed']} contributors, "
                f"{stats['domains_extracted']} domains"
            )
            return stats

        except Exception as exc:
            error_msg = str(exc)
            logger.error(f"GitHub sync failed: {error_msg}")
            if sync_record:
                async with async_session() as session:
                    rec = await session.get(type(sync_record), sync_record.id)
                    if rec:
                        rec.status = "failed"
                        rec.error_message = error_msg
                        rec.synced_at = datetime.now(timezone.utc)
                        await session.commit()
            raise

    return run_async(_run())


def _send_manager_dm(
    slack_client,
    manager_slack_id: str | None,
    jira_key: str,
    assignee_name: str | None,
    assignee_reason: str | None,
    confidence: float,
    story_points: int,
    priority: str,
    title: str,
) -> None:
    """Send DM to manager about auto-assigned ticket."""
    if not manager_slack_id:
        logger.warning("No manager Slack ID configured, skipping manager DM")
        return

    reason_part = f"\nReason: {assignee_reason}" if assignee_reason else ""
    assignee_part = assignee_name or "Unassigned"

    message = (
        f":white_check_mark: Strafe auto-assigned *{jira_key}* to {assignee_part}"
        f"{reason_part}\n"
        f"Confidence: {confidence:.0%} · {story_points} pts · {priority}\n"
        f"_{title}_"
    )

    try:
        slack_client.send_dm(manager_slack_id, message)
        logger.info(f"Sent manager DM to {manager_slack_id}")
    except Exception as e:
        logger.error(f"Failed to send manager DM: {e}")

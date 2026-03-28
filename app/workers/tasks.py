import asyncio
import logging
from uuid import UUID

from app.workers.celery_app import celery_app
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
    """
    Combined task: Analyze thread and auto-generate ticket if actionable.
    Used for automatic mode when thread crosses reply threshold.
    """
    from app.services.slack_client import get_slack_client
    from app.services.claude_classifier import get_classifier
    from app.services.ticket_generator import get_ticket_generator
    from app.database import async_session
    from app.models import SlackThread, DetectedTask, ChannelConfig, Ticket
    from sqlalchemy import select
    from datetime import datetime, timezone

    async def _analyze_and_generate():
        slack_client = get_slack_client()
        classifier = get_classifier()
        generator = get_ticket_generator()

        # Fetch thread messages
        messages = slack_client.get_thread_messages(channel_id, thread_ts)
        if not messages:
            logger.error(f"Could not fetch thread {thread_ts}")
            return None

        thread_content = slack_client.format_thread_for_analysis(messages)

        # Get channel config for sensitivity threshold
        async with async_session() as session:
            config_result = await session.execute(
                select(ChannelConfig).where(ChannelConfig.channel_id == channel_id)
            )
            channel_config = config_result.scalar_one_or_none()

            if not channel_config:
                logger.warning(f"No config for channel {channel_id}")
                return None

            # Get or create thread record
            thread_result = await session.execute(
                select(SlackThread).where(
                    SlackThread.thread_ts == thread_ts,
                    SlackThread.channel_id == channel_id,
                )
            )
            thread = thread_result.scalar_one_or_none()

            if not thread:
                thread = SlackThread(
                    thread_ts=thread_ts,
                    channel_id=channel_id,
                    workspace_id=workspace_id,
                    reply_count=len(messages) - 1,
                )
                session.add(thread)
                await session.flush()

            # Skip if already analyzed
            if thread.last_analyzed_at is not None:
                logger.info(f"Thread {thread_ts} already analyzed, skipping")
                return None

            # Classify with Claude
            classification_result = classifier.classify_thread(thread_content)
            classification = classification_result.get("classification", "conversation")
            confidence = classification_result.get("confidence", 0.0)

            # Mark as analyzed
            thread.last_analyzed_at = datetime.now(timezone.utc)
            thread.reply_count = len(messages) - 1

            # Create detected task record
            detected_task = DetectedTask(
                thread_id=thread.id,
                classification=classification,
                confidence=confidence,
                title=classification_result.get("title"),
                description=classification_result.get("description"),
                priority=classification_result.get("priority"),
                raw_claude_response=classification_result,
                status="pending",
            )
            session.add(detected_task)
            await session.flush()

            # Check if actionable and meets threshold
            if (
                classification in ("task", "bug", "feature_request")
                and confidence >= channel_config.sensitivity
            ):
                logger.info(
                    f"Thread {thread_ts} classified as '{classification}' "
                    f"with {confidence:.0%} confidence - generating ticket"
                )

                # Get thread URL
                thread_url = slack_client.get_permalink(channel_id, thread_ts)
                if not thread_url:
                    thread_url = f"slack://channel?id={channel_id}&message={thread_ts}"

                # Generate full ticket
                ticket_data = await generator.generate_ticket(
                    thread_content=thread_content,
                    channel_name=channel_name,
                    thread_url=thread_url,
                )

                # Create ticket
                ticket = Ticket(
                    detected_task_id=detected_task.id,
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
                    trigger_mode="automatic",
                    status="draft",
                )
                session.add(ticket)

                # Update detected task status
                detected_task.status = "converted"

                await session.commit()
                logger.info(f"Created ticket: {ticket.title}")
                return {"ticket_id": str(ticket.id), "classification": classification}

            await session.commit()
            logger.info(
                f"Thread {thread_ts} classified as '{classification}' "
                f"but does not meet ticket criteria"
            )
            return {"classification": classification, "confidence": confidence}

    return run_async(_analyze_and_generate())

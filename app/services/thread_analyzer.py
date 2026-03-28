from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models import ChannelConfig, SlackThread, DetectedTask
from app.services.slack_client import get_slack_client
from app.services.claude_classifier import get_classifier


async def should_analyze_thread(channel_id: str, thread_ts: str) -> tuple[bool, str | None]:
    """
    Check if a thread should be analyzed based on channel config and reply count.
    Returns (should_analyze, workspace_id).
    """
    async with async_session() as session:
        # Get channel config
        config = await session.execute(
            select(ChannelConfig).where(ChannelConfig.channel_id == channel_id)
        )
        channel_config = config.scalar_one_or_none()

        # If channel not configured or monitoring disabled, skip
        if not channel_config or not channel_config.monitoring_active:
            return False, None

        # Get or create thread record
        thread_result = await session.execute(
            select(SlackThread).where(
                SlackThread.thread_ts == thread_ts,
                SlackThread.channel_id == channel_id,
            )
        )
        thread = thread_result.scalar_one_or_none()

        # Fetch current reply count from Slack
        slack_client = get_slack_client()
        messages = slack_client.get_thread_messages(channel_id, thread_ts)

        if not messages:
            return False, None

        reply_count = len(messages) - 1  # Exclude parent message

        # Update or create thread record
        if thread:
            thread.reply_count = reply_count
        else:
            thread = SlackThread(
                thread_ts=thread_ts,
                channel_id=channel_id,
                workspace_id=channel_config.workspace_id,
                reply_count=reply_count,
            )
            session.add(thread)

        await session.commit()

        # Check if meets reply threshold and hasn't been analyzed yet
        if reply_count >= channel_config.min_replies and thread.last_analyzed_at is None:
            return True, channel_config.workspace_id

        return False, None


async def analyze_thread(channel_id: str, thread_ts: str, workspace_id: str) -> dict | None:
    """
    Analyze a thread with Claude and store the result.
    Returns the classification result if successful.
    """
    slack_client = get_slack_client()
    classifier = get_classifier()

    # Fetch thread messages
    messages = slack_client.get_thread_messages(channel_id, thread_ts)
    if not messages:
        return None

    # Format for Claude
    thread_content = slack_client.format_thread_for_analysis(messages)

    # Get classification
    result = classifier.classify_thread(thread_content)

    async with async_session() as session:
        # Get channel config for sensitivity threshold
        config_result = await session.execute(
            select(ChannelConfig).where(ChannelConfig.channel_id == channel_id)
        )
        channel_config = config_result.scalar_one_or_none()

        if not channel_config:
            return None

        # Get thread record
        thread_result = await session.execute(
            select(SlackThread).where(
                SlackThread.thread_ts == thread_ts,
                SlackThread.channel_id == channel_id,
            )
        )
        thread = thread_result.scalar_one_or_none()

        if not thread:
            return None

        # Mark thread as analyzed
        from datetime import datetime, timezone

        thread.last_analyzed_at = datetime.now(timezone.utc)

        # Only create detected task if classification is actionable and meets confidence threshold
        classification = result.get("classification", "conversation")
        confidence = result.get("confidence", 0.0)

        if (
            classification in ("task", "bug", "feature_request")
            and confidence >= channel_config.sensitivity
        ):
            detected_task = DetectedTask(
                thread_id=thread.id,
                classification=classification,
                confidence=confidence,
                title=result.get("title"),
                description=result.get("description"),
                priority=result.get("priority"),
                raw_claude_response=result,
                status="pending",
            )
            session.add(detected_task)

        await session.commit()

    return result

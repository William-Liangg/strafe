import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.database import async_session
from app.models import (
    AgentAction,
    AgentDecision,
    ChannelConfig,
    DetectedTask,
    SlackThread,
    Sprint,
    SprintState,
    Ticket,
)
from app.services.claude_classifier import get_classifier
from app.services.jira_client import get_jira_client
from app.services.slack_client import get_slack_client
from app.services.ticket_generator import get_ticket_generator

logger = logging.getLogger(__name__)


async def analyze_and_generate_thread(
    channel_id: str,
    thread_ts: str,
    workspace_id: str,
    channel_name: str,
) -> dict | None:
    """Analyze a real Slack thread and either dismiss, draft, or auto-create a ticket."""
    slack_client = get_slack_client()
    classifier = get_classifier()
    generator = get_ticket_generator()

    messages = slack_client.get_thread_messages(channel_id, thread_ts)
    if not messages:
        logger.error(f"Could not fetch thread {thread_ts}")
        return None

    thread_content = slack_client.format_thread_for_analysis(messages)

    async with async_session() as session:
        config_result = await session.execute(
            select(ChannelConfig).where(ChannelConfig.channel_id == channel_id)
        )
        channel_config = config_result.scalar_one_or_none()

        if not channel_config:
            logger.warning(f"No config for channel {channel_id}")
            return None

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
                reply_count=max(len(messages) - 1, 0),
            )
            session.add(thread)
            await session.flush()

        if thread.last_analyzed_at is not None:
            logger.info(f"Thread {thread_ts} already analyzed, skipping")
            return {"action": "skipped", "reason": "already_analyzed"}

        classification_result = classifier.classify_thread(thread_content)
        classification = classification_result.get("classification", "conversation")
        confidence = classification_result.get("confidence", 0.0)

        thread.last_analyzed_at = datetime.now(timezone.utc)
        thread.reply_count = max(len(messages) - 1, 0)

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

        is_actionable = (
            classification in ("task", "bug", "feature_request")
            and confidence >= channel_config.sensitivity
        )

        if not is_actionable:
            reasoning = _build_dismissed_reasoning(
                classification, confidence, channel_config.sensitivity, channel_name
            )
            agent_decision = AgentDecision(
                detected_task_id=detected_task.id,
                action=AgentAction.DISMISSED,
                confidence=confidence,
                reasoning=reasoning,
                channel_name=channel_name,
                auto_approved=False,
            )
            session.add(agent_decision)
            await session.commit()
            return {
                "action": "dismissed",
                "classification": classification,
                "confidence": confidence,
            }

        thread_url = slack_client.get_permalink(channel_id, thread_ts)
        if not thread_url:
            thread_url = f"slack://channel?id={channel_id}&message={thread_ts}"

        ticket_data = await generator.generate_ticket(
            thread_content=thread_content,
            channel_name=channel_name,
            thread_url=thread_url,
        )

        story_points = ticket_data["story_points"]
        assignee_name = ticket_data.get("suggested_assignee_name")
        assignee_slack_id = ticket_data.get("suggested_assignee_slack_id")
        assignee_reason = ticket_data.get("assignee_reason")

        meets_confidence = confidence >= channel_config.auto_approve_threshold
        meets_points = story_points <= channel_config.auto_approve_max_points
        should_auto_approve = meets_confidence and meets_points

        if should_auto_approve:
            jira_client = get_jira_client()
            try:
                jira_result = await jira_client.create_ticket(
                    title=ticket_data["title"],
                    description=ticket_data["description"],
                    priority=ticket_data["priority"],
                    labels=ticket_data["labels"],
                    story_points=story_points,
                )
                jira_key = jira_result["key"]
                jira_url = jira_result["url"]

                active_sprint = await jira_client.get_active_sprint()
                if active_sprint:
                    await jira_client.add_to_sprint(jira_key, active_sprint["id"])

                sprint_result = await session.execute(
                    select(Sprint).where(Sprint.state == SprintState.ACTIVE)
                )
                local_sprint = sprint_result.scalar_one_or_none()

                ticket = Ticket(
                    detected_task_id=detected_task.id,
                    jira_ticket_id=jira_key,
                    jira_ticket_url=jira_url,
                    title=ticket_data["title"],
                    description=ticket_data["description"],
                    priority=ticket_data["priority"],
                    labels=ticket_data["labels"],
                    story_points=story_points,
                    suggested_assignee_slack_id=assignee_slack_id,
                    suggested_assignee_name=assignee_name,
                    assignee_reason=assignee_reason,
                    source_thread_url=thread_url,
                    source_channel_id=channel_id,
                    source_channel_name=channel_name,
                    source_thread_ts=thread_ts,
                    trigger_mode="automatic",
                    status="created",
                    sprint_id=local_sprint.id if local_sprint else None,
                )
                session.add(ticket)
                await session.flush()

                detected_task.status = "converted"

                reasoning = _build_auto_assigned_reasoning(
                    assignee_name=assignee_name,
                    assignee_reason=assignee_reason,
                    confidence=confidence,
                    auto_approve_threshold=channel_config.auto_approve_threshold,
                    story_points=story_points,
                    auto_approve_max_points=channel_config.auto_approve_max_points,
                )

                agent_decision = AgentDecision(
                    ticket_id=ticket.id,
                    detected_task_id=detected_task.id,
                    action=AgentAction.AUTO_ASSIGNED,
                    confidence=confidence,
                    reasoning=reasoning,
                    assignee_name=assignee_name,
                    assignee_reason=assignee_reason,
                    jira_ticket_id=jira_key,
                    channel_name=channel_name,
                    story_points=story_points,
                    auto_approved=True,
                )
                session.add(agent_decision)
                await session.commit()

                _send_assignee_dm(
                    slack_client=slack_client,
                    assignee_slack_id=assignee_slack_id,
                    title=ticket_data["title"],
                    jira_key=jira_key,
                    jira_url=jira_url,
                    priority=ticket_data["priority"],
                    story_points=story_points,
                    channel_name=channel_name,
                )
                _send_manager_dm(
                    slack_client=slack_client,
                    manager_slack_id=channel_config.manager_slack_id,
                    jira_key=jira_key,
                    assignee_name=assignee_name,
                    assignee_reason=assignee_reason,
                    confidence=confidence,
                    story_points=story_points,
                    priority=ticket_data["priority"],
                    title=ticket_data["title"],
                )

                return {
                    "action": "auto_assigned",
                    "ticket_id": str(ticket.id),
                    "jira_key": jira_key,
                }
            except Exception as exc:
                logger.error(f"Jira creation failed, falling back to draft: {exc}")

        ticket = Ticket(
            detected_task_id=detected_task.id,
            title=ticket_data["title"],
            description=ticket_data["description"],
            priority=ticket_data["priority"],
            labels=ticket_data["labels"],
            story_points=story_points,
            suggested_assignee_slack_id=assignee_slack_id,
            suggested_assignee_name=assignee_name,
            assignee_reason=assignee_reason,
            source_thread_url=thread_url,
            source_channel_id=channel_id,
            source_channel_name=channel_name,
            source_thread_ts=thread_ts,
            trigger_mode="automatic",
            status="draft",
        )
        session.add(ticket)
        await session.flush()

        detected_task.status = "converted"
        reasoning = _build_flagged_reasoning(
            assignee_name=assignee_name,
            confidence=confidence,
            auto_approve_threshold=channel_config.auto_approve_threshold,
            story_points=story_points,
            auto_approve_max_points=channel_config.auto_approve_max_points,
        )
        agent_decision = AgentDecision(
            ticket_id=ticket.id,
            detected_task_id=detected_task.id,
            action=AgentAction.FLAGGED_FOR_REVIEW,
            confidence=confidence,
            reasoning=reasoning,
            assignee_name=assignee_name,
            assignee_reason=assignee_reason,
            channel_name=channel_name,
            story_points=story_points,
            auto_approved=False,
        )
        session.add(agent_decision)
        await session.commit()

        return {"action": "flagged_for_review", "ticket_id": str(ticket.id)}


async def scan_monitored_slack_threads(since_hours: int) -> dict:
    """Scan monitored Slack channels for recent threaded conversations."""
    slack_client = get_slack_client()
    oldest = datetime.now(timezone.utc) - timedelta(hours=since_hours)

    async with async_session() as session:
        config_result = await session.execute(
            select(ChannelConfig).where(ChannelConfig.monitoring_active == True)
        )
        channel_configs = config_result.scalars().all()

    channels_scanned = 0
    threads_found = 0
    tickets_generated = 0

    for config in channel_configs:
        channels_scanned += 1
        channel_label = f"#{config.channel_name or config.channel_id}"
        logger.info(f"[SCAN] Scanning channel {channel_label} (id={config.channel_id}, min_replies={config.min_replies})")

        history = slack_client.get_channel_history(
            channel_id=config.channel_id,
            oldest_ts=oldest.timestamp(),
        )

        logger.info(f"[SCAN] {channel_label}: {len(history)} messages fetched in last {since_hours}h")

        channel_threads = 0
        channel_tickets = 0

        for message in history:
            reply_count = int(message.get("reply_count", 0) or 0)
            msg_preview = (message.get("text") or "")[:60].replace("\n", " ")
            if reply_count < config.min_replies:
                logger.info(f"[SCAN] {channel_label}: SKIP (reply_count={reply_count} < min={config.min_replies}) — \"{msg_preview}\"")
                continue

            thread_ts = message.get("thread_ts") or message.get("ts")
            if not thread_ts:
                logger.info(f"[SCAN] {channel_label}: SKIP (no ts) — \"{msg_preview}\"")
                continue

            logger.info(f"[SCAN] {channel_label}: ANALYZING thread_ts={thread_ts} reply_count={reply_count} — \"{msg_preview}\"")
            threads_found += 1
            channel_threads += 1
            result = await analyze_and_generate_thread(
                channel_id=config.channel_id,
                thread_ts=thread_ts,
                workspace_id=config.workspace_id,
                channel_name=(config.channel_name or config.channel_id).replace("#", ""),
            )
            action = result.get("action") if result else "error"
            logger.info(f"[SCAN] {channel_label}: thread_ts={thread_ts} → action={action}")
            if result and result.get("action") in ("auto_assigned", "flagged_for_review"):
                tickets_generated += 1
                channel_tickets += 1

        logger.info(f"[SCAN] {channel_label}: DONE — {channel_threads} threads analyzed, {channel_tickets} tickets generated")

    return {
        "channels_scanned": channels_scanned,
        "threads_found": threads_found,
        "tickets_generated": tickets_generated,
    }


def _build_dismissed_reasoning(
    classification: str,
    confidence: float,
    sensitivity_threshold: float,
    channel_name: str,
) -> str:
    if classification in ("question", "conversation"):
        return (
            f"Thread classified as a {classification} with {confidence:.0%} confidence, "
            f"below the {sensitivity_threshold:.0%} detection threshold for #{channel_name}. "
            f"No ticket generated."
        )
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
    return f"Flagged for manager review - {reason_text}. {assignee_part}".strip()


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
    if not assignee_slack_id:
        return

    message = (
        f":robot_face: Strafe assigned you a new ticket: *{title}* ({jira_key})\n"
        f"Priority: {priority} · {story_points} pts\n"
        f"Detected from #{channel_name}\n"
        f"View in Jira: {jira_url}"
    )
    slack_client.send_dm(assignee_slack_id, message)


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
    if not manager_slack_id:
        return

    reason_part = f"\nReason: {assignee_reason}" if assignee_reason else ""
    assignee_part = assignee_name or "Unassigned"
    message = (
        f":white_check_mark: Strafe auto-assigned *{jira_key}* to {assignee_part}"
        f"{reason_part}\n"
        f"Confidence: {confidence:.0%} · {story_points} pts · {priority}\n"
        f"_{title}_"
    )
    slack_client.send_dm(manager_slack_id, message)

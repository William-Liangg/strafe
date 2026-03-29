import asyncio
import logging
from datetime import datetime, timezone
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
            # Semantic relationship check
            recent_tickets_result = await session.execute(
                select(Ticket)
                .where(Ticket.status.in_(["draft", "created"]))
                .order_by(Ticket.created_at.desc())
                .limit(100)
            )
            recent_tickets = recent_tickets_result.scalars().all()
            
            related_id = None
            relation_type = None
            if recent_tickets:
                try:
                    relation_data = await generator.find_related_ticket(ticket_data, recent_tickets)
                    if relation_data and relation_data.get("related_ticket_id"):
                        related_id = UUID(relation_data["related_ticket_id"])
                        relation_type = relation_data.get("relation_type")
                except Exception as e:
                    logger.error(f"Error checking for related tickets: {e}")

            ticket = Ticket(
                detected_task_id=UUID(detected_task_id) if detected_task_id else None,
                related_ticket_id=related_id,
                relation_type=relation_type,
                title=ticket_data["title"],
                description=ticket_data["description"],
                priority=ticket_data["priority"],
                labels=ticket_data["labels"],
                story_points=ticket_data["story_points"],
                estimated_hours=ticket_data.get("estimated_hours"),
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

    AGENTIC FLOW:
    1. Classify thread with Claude
    2. If actionable (task/bug/feature_request) and meets sensitivity threshold:
       a. Generate full ticket
       b. If confidence >= auto_approve_threshold AND story_points <= auto_approve_max_points:
          - Create Jira ticket immediately (agent mode)
          - Add to active sprint
          - Send DM to assignee
          - Send DM to manager
          - Log agent_decision with action=auto_assigned
       c. Else:
          - Save as draft (human review mode)
          - Log agent_decision with action=flagged_for_review
    3. If not actionable:
       - Log agent_decision with action=dismissed
    """
    from app.services.slack_client import get_slack_client
    from app.services.claude_classifier import get_classifier
    from app.services.ticket_generator import get_ticket_generator
    from app.services.jira_client import get_jira_client
    from app.database import async_session
    from app.models import (
        SlackThread, DetectedTask, ChannelConfig, Ticket,
        AgentDecision, AgentAction, Sprint, SprintState
    )
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

        # Get channel config for sensitivity threshold and auto-approve settings
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

            # Skip if already analyzed (idempotency check)
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

            # Check if actionable and meets sensitivity threshold
            is_actionable = (
                classification in ("task", "bug", "feature_request")
                and confidence >= channel_config.sensitivity
            )

            if not is_actionable:
                # Create DISMISSED agent decision
                reason = _build_dismissed_reasoning(
                    classification, confidence, channel_config.sensitivity, channel_name
                )
                agent_decision = AgentDecision(
                    detected_task_id=detected_task.id,
                    action=AgentAction.DISMISSED,
                    confidence=confidence,
                    reasoning=reason,
                    channel_name=channel_name,
                    auto_approved=False,
                )
                session.add(agent_decision)
                await session.commit()

                logger.info(
                    f"Thread {thread_ts} dismissed: '{classification}' "
                    f"with {confidence:.0%} confidence"
                )
                return {
                    "action": "dismissed",
                    "classification": classification,
                    "confidence": confidence,
                    "reasoning": reason,
                }

            # Thread is actionable - generate full ticket
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

            # Semantic relationship check
            recent_tickets_result = await session.execute(
                select(Ticket)
                .where(Ticket.status.in_(["draft", "created"]))
                .order_by(Ticket.created_at.desc())
                .limit(100)
            )
            recent_tickets = recent_tickets_result.scalars().all()
            
            related_id = None
            relation_type = None
            if recent_tickets:
                try:
                    relation_data = await generator.find_related_ticket(ticket_data, recent_tickets)
                    if relation_data and relation_data.get("related_ticket_id"):
                        related_id = UUID(relation_data["related_ticket_id"])
                        relation_type = relation_data.get("relation_type")
                except Exception as e:
                    logger.error(f"Error checking for related tickets: {e}")

            story_points = ticket_data["story_points"]
            assignee_name = ticket_data.get("suggested_assignee_name")
            assignee_slack_id = ticket_data.get("suggested_assignee_slack_id")
            assignee_reason = ticket_data.get("assignee_reason")

            # Check auto-approve conditions
            meets_confidence = confidence >= channel_config.auto_approve_threshold
            meets_points = story_points <= channel_config.auto_approve_max_points
            should_auto_approve = meets_confidence and meets_points

            if should_auto_approve:
                # AGENT MODE: Auto-approve and create Jira ticket immediately
                jira_client = get_jira_client()

                try:
                    # Create Jira ticket
                    jira_result = await jira_client.create_ticket(
                        title=ticket_data["title"],
                        description=ticket_data["description"],
                        priority=ticket_data["priority"],
                        labels=ticket_data["labels"],
                        story_points=story_points,
                    )
                    jira_key = jira_result["key"]
                    jira_url = jira_result["url"]

                    # Add to active sprint
                    active_sprint = await jira_client.get_active_sprint()
                    if active_sprint:
                        await jira_client.add_to_sprint(jira_key, active_sprint["id"])

                    # Get local active sprint for DB association
                    sprint_result = await session.execute(
                        select(Sprint).where(Sprint.state == SprintState.ACTIVE)
                    )
                    local_sprint = sprint_result.scalar_one_or_none()

                    # Create ticket in DB with status=created
                    ticket = Ticket(
                        detected_task_id=detected_task.id,
                        related_ticket_id=related_id,
                        relation_type=relation_type,
                        jira_ticket_id=jira_key,
                        jira_ticket_url=jira_url,
                        title=ticket_data["title"],
                        description=ticket_data["description"],
                        priority=ticket_data["priority"],
                        labels=ticket_data["labels"],
                        story_points=story_points,
                        estimated_hours=ticket_data.get("estimated_hours"),
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

                    # Update detected task status
                    detected_task.status = "converted"

                    # Build reasoning
                    reasoning = _build_auto_assigned_reasoning(
                        assignee_name=assignee_name,
                        assignee_reason=assignee_reason,
                        confidence=confidence,
                        auto_approve_threshold=channel_config.auto_approve_threshold,
                        story_points=story_points,
                        auto_approve_max_points=channel_config.auto_approve_max_points,
                    )

                    # Create AUTO_ASSIGNED agent decision
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
                        estimated_hours=ticket_data.get("estimated_hours"),
                        auto_approved=True,
                    )
                    session.add(agent_decision)
                    await session.commit()

                    # Send Slack DMs
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

                    logger.info(
                        f"AGENT: Auto-assigned ticket {jira_key} to {assignee_name}"
                    )
                    return {
                        "action": "auto_assigned",
                        "ticket_id": str(ticket.id),
                        "jira_key": jira_key,
                        "assignee": assignee_name,
                        "reasoning": reasoning,
                    }

                except Exception as e:
                    logger.error(f"Jira creation failed, falling back to draft: {e}")
                    # Fall through to draft creation

            # HUMAN REVIEW MODE: Create draft ticket
            ticket = Ticket(
                detected_task_id=detected_task.id,
                related_ticket_id=related_id,
                relation_type=relation_type,
                title=ticket_data["title"],
                description=ticket_data["description"],
                priority=ticket_data["priority"],
                labels=ticket_data["labels"],
                story_points=story_points,
                estimated_hours=ticket_data.get("estimated_hours"),
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

            # Update detected task status
            detected_task.status = "converted"

            # Build reasoning for flagged_for_review
            reasoning = _build_flagged_reasoning(
                assignee_name=assignee_name,
                confidence=confidence,
                auto_approve_threshold=channel_config.auto_approve_threshold,
                story_points=story_points,
                auto_approve_max_points=channel_config.auto_approve_max_points,
            )

            # Create FLAGGED_FOR_REVIEW agent decision
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
                estimated_hours=ticket_data.get("estimated_hours"),
                auto_approved=False,
            )
            session.add(agent_decision)
            await session.commit()

            logger.info(f"Created draft ticket: {ticket.title} (needs review)")
            return {
                "action": "flagged_for_review",
                "ticket_id": str(ticket.id),
                "classification": classification,
                "reasoning": reasoning,
            }

    return run_async(_analyze_and_generate())


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
def github_sync_task(self):
    """
    Celery task: crawl the configured GitHub repo, infer expertise domains
    per contributor with Claude, and write results to the expertise_map table.
    Updates the corresponding GithubSync record on completion or failure.
    """
    from app.config import get_settings
    from app.services.github_analyzer import analyze_repo
    from app.models import GithubSync
    from sqlalchemy import select, create_engine
    from sqlalchemy.orm import Session

    settings = get_settings()
    task_id = self.request.id

    # Use sync engine for Celery tasks to avoid async connection conflicts
    sync_db_url = settings.database_url.replace("+asyncpg", "").replace("postgresql+asyncpg", "postgresql")
    engine = create_engine(sync_db_url)

    def update_sync_record(status: str, error_msg: str | None = None, stats: dict | None = None):
        """Helper to update the GithubSync record synchronously."""
        with Session(engine) as session:
            result = session.execute(
                select(GithubSync).where(GithubSync.celery_task_id == task_id).limit(1)
            )
            rec = result.scalar_one_or_none()
            if rec:
                rec.status = status
                rec.synced_at = datetime.now(timezone.utc)
                if error_msg:
                    rec.error_message = error_msg
                if stats:
                    rec.contributors_analyzed = stats.get("contributors_analyzed", 0)
                    rec.domains_extracted = stats.get("domains_extracted", 0)
                session.commit()

    owner = settings.github_repo_owner
    repo = settings.github_repo_name
    token = settings.github_token

    if not owner or not repo or not token:
        error_msg = (
            "GitHub analysis requires GITHUB_REPO_OWNER, GITHUB_REPO_NAME, "
            "and GITHUB_TOKEN in .env"
        )
        logger.error(error_msg)
        update_sync_record("failed", error_msg=error_msg)
        return {"error": error_msg}

    async def _analyze():
        return await analyze_repo(owner=owner, repo=repo, github_token=token)

    try:
        stats = run_async(_analyze())
        update_sync_record("success", stats=stats)

        logger.info(
            f"GitHub sync complete: {stats['contributors_analyzed']} contributors, "
            f"{stats['domains_extracted']} domains"
        )
        return stats

    except Exception as exc:
        error_msg = str(exc)
        logger.error(f"GitHub sync failed: {error_msg}")
        update_sync_record("failed", error_msg=error_msg)
        raise


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

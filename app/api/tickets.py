import logging
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Ticket, TicketStatus, TicketPriority, DetectedTask
from app.services.jira_client import get_jira_client, JiraClientError
from app.services.slack_client import get_slack_client
from app.workers.tasks import generate_ticket_task

logger = logging.getLogger(__name__)
router = APIRouter()


# --- Pydantic Response Models ---


class TicketResponse(BaseModel):
    id: str
    detected_task_id: str | None
    related_ticket_id: str | None
    relation_type: str | None
    jira_ticket_id: str | None
    jira_ticket_url: str | None
    title: str
    description: str
    priority: str
    labels: list[str]
    story_points: int
    estimated_hours: float | None
    suggested_assignee_slack_id: str | None
    suggested_assignee_name: str | None
    assignee_reason: str | None
    source_thread_url: str | None
    source_channel_id: str | None
    source_channel_name: str | None
    source_thread_ts: str | None
    origin_type: str
    trigger_mode: str
    status: str
    rejection_reason: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TicketListResponse(BaseModel):
    tickets: list[TicketResponse]
    total: int


class TicketUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: str | None = Field(None, pattern="^(low|medium|high|critical)$")
    story_points: int | None = Field(None, ge=1, le=8)
    estimated_hours: float | None = Field(None, ge=0.25, le=80.0)
    suggested_assignee_slack_id: str | None = None
    suggested_assignee_name: str | None = None
    related_ticket_id: str | None = None
    relation_type: str | None = None
    labels: list[str] | None = None


class TicketRejectRequest(BaseModel):
    reason: str | None = None


class TicketApproveResponse(BaseModel):
    id: str
    jira_ticket_id: str | None
    jira_ticket_url: str | None
    status: str
    message: str


class GenerateTicketResponse(BaseModel):
    message: str
    task_id: str | None = None


def _ticket_to_response(ticket: Ticket) -> TicketResponse:
    """Convert a Ticket model to response."""
    return TicketResponse(
        id=str(ticket.id),
        detected_task_id=str(ticket.detected_task_id) if ticket.detected_task_id else None,
        related_ticket_id=str(ticket.related_ticket_id) if ticket.related_ticket_id else None,
        relation_type=ticket.relation_type,
        jira_ticket_id=ticket.jira_ticket_id,
        jira_ticket_url=ticket.jira_ticket_url,
        title=ticket.title,
        description=ticket.description,
        priority=ticket.priority.value if hasattr(ticket.priority, 'value') else ticket.priority,
        labels=ticket.labels or [],
        story_points=ticket.story_points,
        estimated_hours=ticket.estimated_hours,
        suggested_assignee_slack_id=ticket.suggested_assignee_slack_id,
        suggested_assignee_name=ticket.suggested_assignee_name,
        assignee_reason=ticket.assignee_reason,
        source_thread_url=ticket.source_thread_url,
        source_channel_id=ticket.source_channel_id,
        source_channel_name=ticket.source_channel_name,
        source_thread_ts=ticket.source_thread_ts,
        origin_type=ticket.origin_type.value if hasattr(ticket.origin_type, 'value') else ticket.origin_type,
        trigger_mode=ticket.trigger_mode.value if hasattr(ticket.trigger_mode, 'value') else ticket.trigger_mode,
        status=ticket.status.value if hasattr(ticket.status, 'value') else ticket.status,
        rejection_reason=ticket.rejection_reason,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )


# --- Endpoints ---


@router.get("/", response_model=TicketListResponse)
async def list_tickets(
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """List all tickets with optional filtering."""
    query = select(Ticket)

    if status:
        query = query.where(Ticket.status == status)

    query = query.order_by(Ticket.created_at.desc())

    # Get total count
    from sqlalchemy import func
    count_query = select(func.count(Ticket.id))
    if status:
        count_query = count_query.where(Ticket.status == status)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    tickets = result.scalars().all()

    return TicketListResponse(
        tickets=[_ticket_to_response(t) for t in tickets],
        total=total,
    )


@router.get("/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single ticket by ID."""
    result = await db.execute(
        select(Ticket).where(Ticket.id == UUID(ticket_id))
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    return _ticket_to_response(ticket)


@router.patch("/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: str,
    updates: TicketUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update a draft ticket before approval."""
    result = await db.execute(
        select(Ticket).where(Ticket.id == UUID(ticket_id))
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

        # Edit restrictions removed per request to make tickets editable

    update_data = updates.model_dump(exclude_unset=True)

    # Handle priority enum
    if "priority" in update_data:
        update_data["priority"] = TicketPriority(update_data["priority"])

    # Validate story points is fibonacci
    if "story_points" in update_data:
        valid_points = [1, 2, 3, 5, 8]
        if update_data["story_points"] not in valid_points:
            raise HTTPException(
                status_code=400,
                detail="Story points must be fibonacci: 1, 2, 3, 5, or 8"
            )

    for key, value in update_data.items():
        setattr(ticket, key, value)

    await db.commit()
    await db.refresh(ticket)

    return _ticket_to_response(ticket)


@router.post("/{ticket_id}/approve", response_model=TicketApproveResponse)
async def approve_ticket(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Approve a ticket and create it in Jira."""
    result = await db.execute(
        select(Ticket).where(Ticket.id == UUID(ticket_id))
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Idempotency check - don't create duplicate Jira tickets
    if ticket.status != TicketStatus.DRAFT:
        return TicketApproveResponse(
            id=str(ticket.id),
            jira_ticket_id=ticket.jira_ticket_id,
            jira_ticket_url=ticket.jira_ticket_url,
            status=ticket.status.value if hasattr(ticket.status, 'value') else ticket.status,
            message="Ticket already processed" if ticket.status == TicketStatus.CREATED else "Ticket was rejected",
        )

    # Mark as approved
    ticket.status = TicketStatus.APPROVED
    await db.commit()

    # Create Jira ticket
    jira_client = get_jira_client()
    try:
        jira_result = await jira_client.create_ticket(
            title=ticket.title,
            description=ticket.description,
            priority=ticket.priority.value if hasattr(ticket.priority, 'value') else ticket.priority,
            labels=ticket.labels or [],
            story_points=ticket.story_points,
        )

        ticket.jira_ticket_id = jira_result["key"]
        ticket.jira_ticket_url = jira_result["url"]
        ticket.status = TicketStatus.CREATED

        # Try to add to active sprint and assign sprint to ticket
        sprint = await jira_client.get_active_sprint()
        if sprint:
            await jira_client.add_to_sprint(jira_result["key"], sprint["id"])

            # Look up or create sprint record in our DB
            from app.models import Sprint
            jira_sprint_id = sprint.get("id")
            if jira_sprint_id:
                sprint_result = await db.execute(
                    select(Sprint).where(Sprint.jira_sprint_id == jira_sprint_id)
                )
                db_sprint = sprint_result.scalar_one_or_none()

                if not db_sprint:
                    # Create sprint record
                    db_sprint = Sprint(
                        jira_sprint_id=jira_sprint_id,
                        name=sprint.get("name", f"Sprint {jira_sprint_id}"),
                        state="active",
                    )
                    db.add(db_sprint)
                    await db.flush()

                ticket.sprint_id = db_sprint.id

        await db.commit()

        # Send Slack DM to assignee
        if ticket.suggested_assignee_slack_id:
            slack_client = get_slack_client()
            dm_text = (
                f"You've been assigned a new ticket: *{ticket.title}* ({ticket.jira_ticket_id})\n"
                f"Priority: {ticket.priority.value if hasattr(ticket.priority, 'value') else ticket.priority} | "
                f"{ticket.story_points} points\n"
                f"Jira: {ticket.jira_ticket_url}"
            )
            slack_client.send_dm(ticket.suggested_assignee_slack_id, dm_text)

        logger.info(f"Created Jira ticket {ticket.jira_ticket_id} for ticket {ticket.id}")

        return TicketApproveResponse(
            id=str(ticket.id),
            jira_ticket_id=ticket.jira_ticket_id,
            jira_ticket_url=ticket.jira_ticket_url,
            status="created",
            message=f"Ticket created in Jira: {ticket.jira_ticket_id}",
        )

    except JiraClientError as e:
        logger.error(f"Jira API error: {e.message}")
        ticket.jira_ticket_id = "JIRA_ERROR"
        ticket.status = TicketStatus.CREATED  # Mark as created to prevent retries
        await db.commit()

        return TicketApproveResponse(
            id=str(ticket.id),
            jira_ticket_id="JIRA_ERROR",
            jira_ticket_url=None,
            status="created",
            message=f"Jira error: {e.message}",
        )


@router.post("/{ticket_id}/reject", response_model=TicketResponse)
async def reject_ticket(
    ticket_id: str,
    request: TicketRejectRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Reject a ticket."""
    result = await db.execute(
        select(Ticket).where(Ticket.id == UUID(ticket_id))
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket.status != TicketStatus.DRAFT:
        raise HTTPException(
            status_code=400,
            detail="Can only reject tickets in draft status"
        )

    ticket.status = TicketStatus.REJECTED
    if request and request.reason:
        ticket.rejection_reason = request.reason

    await db.commit()
    await db.refresh(ticket)

    logger.info(f"Rejected ticket {ticket.id}")

    return _ticket_to_response(ticket)


# --- Task-related endpoints (moved from tasks.py) ---


@router.get("/tasks/{task_id}/ticket", response_model=TicketResponse | None)
async def get_task_ticket(
    task_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get the ticket associated with a detected task."""
    result = await db.execute(
        select(Ticket).where(Ticket.detected_task_id == UUID(task_id))
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="No ticket found for this task")

    return _ticket_to_response(ticket)


@router.post("/tasks/{task_id}/generate", response_model=GenerateTicketResponse, status_code=202)
async def generate_ticket_for_task(
    task_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger ticket generation for a detected task."""
    # Get the detected task
    result = await db.execute(
        select(DetectedTask).where(DetectedTask.id == UUID(task_id))
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Check if ticket already exists
    existing_ticket = await db.execute(
        select(Ticket).where(Ticket.detected_task_id == UUID(task_id))
    )
    if existing_ticket.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Ticket already exists for this task"
        )

    # Get thread info
    from app.models import SlackThread
    thread_result = await db.execute(
        select(SlackThread).where(SlackThread.id == task.thread_id)
    )
    thread = thread_result.scalar_one_or_none()

    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    # Get channel name
    from app.models import ChannelConfig
    config_result = await db.execute(
        select(ChannelConfig).where(ChannelConfig.channel_id == thread.channel_id)
    )
    config = config_result.scalar_one_or_none()
    channel_name = config.channel_name if config else "unknown"

    # Enqueue ticket generation
    celery_task = generate_ticket_task.delay(
        channel_id=thread.channel_id,
        thread_ts=thread.thread_ts,
        channel_name=channel_name,
        trigger_mode="automatic",
        detected_task_id=task_id,
    )

    return GenerateTicketResponse(
        message="Ticket generation started",
        task_id=celery_task.id,
    )

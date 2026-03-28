from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AgentDecision, AgentAction, ChannelConfig, Sprint, SprintState

router = APIRouter()


# Pydantic response models
class AgentDecisionResponse(BaseModel):
    id: str
    ticket_id: str | None
    detected_task_id: str | None
    action: str
    confidence: float
    reasoning: str
    assignee_name: str | None
    assignee_reason: str | None
    jira_ticket_id: str | None
    channel_name: str
    story_points: int | None
    auto_approved: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AgentDecisionsListResponse(BaseModel):
    decisions: list[AgentDecisionResponse]
    total: int


class AgentStatusResponse(BaseModel):
    agent_status: str
    monitored_channels: int
    decisions_today: int
    auto_assigned_today: int
    flagged_for_review_today: int
    dismissed_today: int
    avg_confidence_today: float
    last_decision_at: datetime | None
    active_sprint: str | None
    sprint_adhoc_percentage: float | None


@router.get("/decisions", response_model=AgentDecisionsListResponse)
async def get_agent_decisions(
    action: str | None = Query(None, description="Filter by action type"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """
    Get agent decision log.
    Returns the most recent decisions ordered by created_at desc.
    """
    # Build query
    query = select(AgentDecision).order_by(AgentDecision.created_at.desc())

    # Apply action filter if provided
    if action:
        try:
            action_enum = AgentAction(action)
            query = query.where(AgentDecision.action == action_enum)
        except ValueError:
            pass  # Invalid action, ignore filter

    # Get total count
    count_query = select(func.count(AgentDecision.id))
    if action:
        try:
            action_enum = AgentAction(action)
            count_query = count_query.where(AgentDecision.action == action_enum)
        except ValueError:
            pass

    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Apply pagination
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    decisions = result.scalars().all()

    return AgentDecisionsListResponse(
        decisions=[
            AgentDecisionResponse(
                id=str(d.id),
                ticket_id=str(d.ticket_id) if d.ticket_id else None,
                detected_task_id=str(d.detected_task_id) if d.detected_task_id else None,
                action=d.action.value,
                confidence=d.confidence,
                reasoning=d.reasoning,
                assignee_name=d.assignee_name,
                assignee_reason=d.assignee_reason,
                jira_ticket_id=d.jira_ticket_id,
                channel_name=d.channel_name,
                story_points=d.story_points,
                auto_approved=d.auto_approved,
                created_at=d.created_at,
            )
            for d in decisions
        ],
        total=total,
    )


@router.get("/status", response_model=AgentStatusResponse)
async def get_agent_status(
    db: AsyncSession = Depends(get_db),
):
    """
    Get real-time agent status snapshot.
    """
    # Get monitored channels count
    channels_result = await db.execute(
        select(func.count(ChannelConfig.channel_id)).where(
            ChannelConfig.monitoring_active == True
        )
    )
    monitored_channels = channels_result.scalar() or 0

    # Get today's start (UTC)
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    # Get decisions today
    decisions_today_result = await db.execute(
        select(func.count(AgentDecision.id)).where(
            AgentDecision.created_at >= today_start
        )
    )
    decisions_today = decisions_today_result.scalar() or 0

    # Get auto_assigned today
    auto_assigned_result = await db.execute(
        select(func.count(AgentDecision.id)).where(
            AgentDecision.created_at >= today_start,
            AgentDecision.action == AgentAction.AUTO_ASSIGNED,
        )
    )
    auto_assigned_today = auto_assigned_result.scalar() or 0

    # Get flagged_for_review today
    flagged_result = await db.execute(
        select(func.count(AgentDecision.id)).where(
            AgentDecision.created_at >= today_start,
            AgentDecision.action == AgentAction.FLAGGED_FOR_REVIEW,
        )
    )
    flagged_for_review_today = flagged_result.scalar() or 0

    # Get dismissed today
    dismissed_result = await db.execute(
        select(func.count(AgentDecision.id)).where(
            AgentDecision.created_at >= today_start,
            AgentDecision.action == AgentAction.DISMISSED,
        )
    )
    dismissed_today = dismissed_result.scalar() or 0

    # Get average confidence today
    avg_confidence_result = await db.execute(
        select(func.avg(AgentDecision.confidence)).where(
            AgentDecision.created_at >= today_start
        )
    )
    avg_confidence_today = avg_confidence_result.scalar() or 0.0

    # Get last decision
    last_decision_result = await db.execute(
        select(AgentDecision.created_at)
        .order_by(AgentDecision.created_at.desc())
        .limit(1)
    )
    last_decision = last_decision_result.scalar_one_or_none()

    # Get active sprint info
    sprint_result = await db.execute(
        select(Sprint).where(Sprint.state == SprintState.ACTIVE)
    )
    active_sprint = sprint_result.scalar_one_or_none()

    # Determine agent status based on last activity
    agent_status = "active"
    if last_decision:
        hours_since_last = (datetime.now(timezone.utc) - last_decision).total_seconds() / 3600
        if hours_since_last > 24:
            agent_status = "offline"
        elif hours_since_last > 1:
            agent_status = "idle"

    return AgentStatusResponse(
        agent_status=agent_status,
        monitored_channels=monitored_channels,
        decisions_today=decisions_today,
        auto_assigned_today=auto_assigned_today,
        flagged_for_review_today=flagged_for_review_today,
        dismissed_today=dismissed_today,
        avg_confidence_today=round(avg_confidence_today, 2),
        last_decision_at=last_decision,
        active_sprint=active_sprint.name if active_sprint else None,
        sprint_adhoc_percentage=active_sprint.adhoc_percentage if active_sprint else None,
    )

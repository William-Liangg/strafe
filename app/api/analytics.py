import logging
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Sprint
from app.services.classification_service import (
    get_sprint_breakdown,
    get_channel_breakdown,
    get_engineer_adhoc_load,
    get_adhoc_trend,
    get_top_source_channels,
    get_analytics_summary,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# --- Pydantic Response Models ---


class SprintBreakdownResponse(BaseModel):
    sprint_id: str
    sprint_name: str
    state: str
    start_date: str | None
    end_date: str | None
    adhoc_count: int
    planned_count: int
    total_count: int
    adhoc_percentage: float
    planned_percentage: float
    total_story_points_adhoc: int
    total_story_points_planned: int
    total_story_points: int
    top_source_channel: str | None


class SprintListResponse(BaseModel):
    sprints: list[SprintBreakdownResponse]
    total: int


class ChannelBreakdownItem(BaseModel):
    channel_name: str
    count: int
    percentage: float


class ChannelBreakdownResponse(BaseModel):
    channels: list[ChannelBreakdownItem]
    since_days: int


class EngineerLoadItem(BaseModel):
    engineer_name: str
    engineer_slack_id: str | None
    adhoc_tickets: int
    adhoc_points: int


class EngineerLoadResponse(BaseModel):
    engineers: list[EngineerLoadItem]
    sprint_id: str | None


class TrendItem(BaseModel):
    sprint_id: str
    sprint_name: str
    adhoc_percentage: float
    adhoc_count: int
    planned_count: int
    start_date: str | None


class TrendResponse(BaseModel):
    trend: list[TrendItem]
    num_sprints: int


class TopChannelItem(BaseModel):
    channel_name: str
    count: int
    story_points: int


class ComparisonResponse(BaseModel):
    current_percentage: float
    last_percentage: float
    difference: float
    direction: str
    message: str


class SummaryResponse(BaseModel):
    current_sprint: SprintBreakdownResponse | None
    trend: list[TrendItem]
    top_source_channels: list[TopChannelItem]
    top_engineers_adhoc_load: list[EngineerLoadItem]
    comparison_to_last_sprint: ComparisonResponse | None
    total_adhoc_this_sprint: int


# --- Endpoints ---


@router.get("/sprints", response_model=SprintListResponse)
async def list_sprints(
    state: str | None = None,
    limit: int = Query(default=10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List all sprints with full breakdown."""
    query = select(Sprint)

    if state:
        query = query.where(Sprint.state == state)

    query = query.order_by(Sprint.start_date.desc()).limit(limit)

    result = await db.execute(query)
    sprints = result.scalars().all()

    breakdowns = []
    for sprint in sprints:
        breakdown = await get_sprint_breakdown(str(sprint.id))
        if breakdown:
            breakdowns.append(SprintBreakdownResponse(**breakdown))

    return SprintListResponse(sprints=breakdowns, total=len(breakdowns))


@router.get("/sprints/{sprint_id}", response_model=SprintBreakdownResponse)
async def get_sprint(sprint_id: str):
    """Get full breakdown for a single sprint."""
    breakdown = await get_sprint_breakdown(sprint_id)
    if not breakdown:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Sprint not found")

    return SprintBreakdownResponse(**breakdown)


@router.get("/channels", response_model=ChannelBreakdownResponse)
async def get_channels(
    since_days: int = Query(default=90, ge=1, le=365),
):
    """Get channel breakdown for adhoc tickets."""
    channels = await get_channel_breakdown(since_days)
    return ChannelBreakdownResponse(
        channels=[ChannelBreakdownItem(**c) for c in channels],
        since_days=since_days,
    )


@router.get("/engineers", response_model=EngineerLoadResponse)
async def get_engineers(
    sprint_id: str | None = None,
):
    """Get engineer adhoc load rankings."""
    engineers = await get_engineer_adhoc_load(sprint_id)
    return EngineerLoadResponse(
        engineers=[EngineerLoadItem(**e) for e in engineers],
        sprint_id=sprint_id,
    )


@router.get("/trend", response_model=TrendResponse)
async def get_trend(
    num_sprints: int = Query(default=6, ge=1, le=20),
):
    """Get adhoc percentage trend across sprints."""
    trend = await get_adhoc_trend(num_sprints)
    return TrendResponse(
        trend=[TrendItem(**t) for t in trend],
        num_sprints=num_sprints,
    )


@router.get("/summary", response_model=SummaryResponse)
async def get_summary():
    """Get full dashboard summary in a single call."""
    summary = await get_analytics_summary()

    return SummaryResponse(
        current_sprint=SprintBreakdownResponse(**summary["current_sprint"]) if summary["current_sprint"] else None,
        trend=[TrendItem(**t) for t in summary["trend"]],
        top_source_channels=[TopChannelItem(**c) for c in summary["top_source_channels"]],
        top_engineers_adhoc_load=[EngineerLoadItem(**e) for e in summary["top_engineers_adhoc_load"]],
        comparison_to_last_sprint=ComparisonResponse(**summary["comparison_to_last_sprint"]) if summary["comparison_to_last_sprint"] else None,
        total_adhoc_this_sprint=summary["total_adhoc_this_sprint"],
    )

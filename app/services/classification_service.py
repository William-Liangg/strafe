import logging
from uuid import UUID
from sqlalchemy import select, func, case, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models import Ticket, Sprint, SprintState

logger = logging.getLogger(__name__)


async def get_sprint_breakdown(sprint_id: str) -> dict:
    """Get adhoc vs planned breakdown for a single sprint."""
    async with async_session() as session:
        sprint_uuid = UUID(sprint_id)

        # Get sprint
        sprint_result = await session.execute(
            select(Sprint).where(Sprint.id == sprint_uuid)
        )
        sprint = sprint_result.scalar_one_or_none()

        if not sprint:
            return {}

        # For active sprints, compute live; for closed, use stored metrics
        if sprint.state == SprintState.ACTIVE:
            adhoc_result = await session.execute(
                select(
                    func.count(Ticket.id),
                    func.coalesce(func.sum(Ticket.story_points), 0)
                ).where(
                    Ticket.sprint_id == sprint_uuid,
                    Ticket.origin_type == "adhoc"
                )
            )
            adhoc_count, adhoc_points = adhoc_result.one()

            planned_result = await session.execute(
                select(
                    func.count(Ticket.id),
                    func.coalesce(func.sum(Ticket.story_points), 0)
                ).where(
                    Ticket.sprint_id == sprint_uuid,
                    Ticket.origin_type == "planned"
                )
            )
            planned_count, planned_points = planned_result.one()

            total = adhoc_count + planned_count
            adhoc_percentage = (adhoc_count / total * 100) if total > 0 else 0.0

            # Get top source channel
            channel_result = await session.execute(
                select(
                    Ticket.source_channel_name,
                    func.count(Ticket.id).label("count")
                ).where(
                    Ticket.sprint_id == sprint_uuid,
                    Ticket.origin_type == "adhoc",
                    Ticket.source_channel_name.isnot(None)
                ).group_by(Ticket.source_channel_name)
                .order_by(desc("count"))
                .limit(1)
            )
            top_channel_row = channel_result.first()
            top_source_channel = top_channel_row[0] if top_channel_row else None
        else:
            # Use stored metrics
            adhoc_count = sprint.adhoc_count
            planned_count = sprint.planned_count
            adhoc_percentage = sprint.adhoc_percentage
            adhoc_points = sprint.total_story_points_adhoc
            planned_points = sprint.total_story_points_planned
            top_source_channel = sprint.top_source_channel

        return {
            "sprint_id": str(sprint.id),
            "sprint_name": sprint.name,
            "state": sprint.state.value if hasattr(sprint.state, 'value') else sprint.state,
            "start_date": sprint.start_date.isoformat() if sprint.start_date else None,
            "end_date": sprint.end_date.isoformat() if sprint.end_date else None,
            "adhoc_count": adhoc_count,
            "planned_count": planned_count,
            "total_count": adhoc_count + planned_count,
            "adhoc_percentage": round(adhoc_percentage, 1),
            "planned_percentage": round(100 - adhoc_percentage, 1) if adhoc_count + planned_count > 0 else 0.0,
            "total_story_points_adhoc": adhoc_points,
            "total_story_points_planned": planned_points,
            "total_story_points": adhoc_points + planned_points,
            "top_source_channel": top_source_channel,
        }


async def get_channel_breakdown(since_days: int = 90) -> list[dict]:
    """Get channels ranked by adhoc ticket count."""
    from datetime import datetime, timezone, timedelta

    cutoff = datetime.now(timezone.utc) - timedelta(days=since_days)

    async with async_session() as session:
        result = await session.execute(
            select(
                Ticket.source_channel_name,
                func.count(Ticket.id).label("count")
            ).where(
                Ticket.origin_type == "adhoc",
                Ticket.source_channel_name.isnot(None),
                Ticket.created_at >= cutoff
            ).group_by(Ticket.source_channel_name)
            .order_by(desc("count"))
        )
        rows = result.all()

        total = sum(r[1] for r in rows)
        return [
            {
                "channel_name": row[0],
                "count": row[1],
                "percentage": round(row[1] / total * 100, 1) if total > 0 else 0.0
            }
            for row in rows
        ]


async def get_engineer_adhoc_load(sprint_id: str | None = None) -> list[dict]:
    """Get engineers ranked by adhoc ticket load."""
    async with async_session() as session:
        query = select(
            Ticket.suggested_assignee_name,
            Ticket.suggested_assignee_slack_id,
            func.count(Ticket.id).label("adhoc_tickets"),
            func.coalesce(func.sum(Ticket.story_points), 0).label("adhoc_points")
        ).where(
            Ticket.origin_type == "adhoc",
            Ticket.suggested_assignee_name.isnot(None)
        )

        if sprint_id:
            query = query.where(Ticket.sprint_id == UUID(sprint_id))

        query = query.group_by(
            Ticket.suggested_assignee_name,
            Ticket.suggested_assignee_slack_id
        ).order_by(desc("adhoc_tickets"))

        result = await session.execute(query)
        rows = result.all()

        return [
            {
                "engineer_name": row[0],
                "engineer_slack_id": row[1],
                "adhoc_tickets": row[2],
                "adhoc_points": row[3]
            }
            for row in rows
        ]


async def get_adhoc_trend(num_sprints: int = 6) -> list[dict]:
    """Get adhoc percentage trend across last N sprints (including active)."""
    async with async_session() as session:
        # Include both closed and active sprints for full trend visibility
        result = await session.execute(
            select(Sprint)
            .where(Sprint.state.in_(["closed", "active"]))
            .order_by(Sprint.start_date.desc())
            .limit(num_sprints)
        )
        sprints = result.scalars().all()

        # Reverse to get chronological order
        sprints = list(reversed(sprints))

        return [
            {
                "sprint_id": str(sprint.id),
                "sprint_name": sprint.name,
                "adhoc_percentage": sprint.adhoc_percentage,
                "adhoc_count": sprint.adhoc_count,
                "planned_count": sprint.planned_count,
                "start_date": sprint.start_date.isoformat() if sprint.start_date else None,
            }
            for sprint in sprints
        ]


async def get_top_source_channels(sprint_id: str | None = None, limit: int = 5) -> list[dict]:
    """Get top source channels for adhoc tickets."""
    async with async_session() as session:
        query = select(
            Ticket.source_channel_name,
            func.count(Ticket.id).label("count"),
            func.coalesce(func.sum(Ticket.story_points), 0).label("story_points")
        ).where(
            Ticket.origin_type == "adhoc",
            Ticket.source_channel_name.isnot(None)
        )

        if sprint_id:
            query = query.where(Ticket.sprint_id == UUID(sprint_id))

        query = query.group_by(Ticket.source_channel_name).order_by(desc("count")).limit(limit)

        result = await session.execute(query)
        rows = result.all()

        return [
            {
                "channel_name": row[0],
                "count": row[1],
                "story_points": row[2]
            }
            for row in rows
        ]


async def get_engineer_workload_breakdown(current_sprint_id: str | None = None, last_sprint_id: str | None = None) -> dict:
    """Get comprehensive engineer workload data for enterprise dashboard."""
    from app.models import ExpertiseMap

    async with async_session() as session:
        # Get all engineers with any tickets in current sprint (both adhoc and planned)
        base_query = select(
            Ticket.suggested_assignee_name,
            Ticket.suggested_assignee_slack_id,
            Ticket.origin_type,
            func.count(Ticket.id).label("ticket_count"),
            func.coalesce(func.sum(Ticket.story_points), 0).label("total_points")
        ).where(
            Ticket.suggested_assignee_name.isnot(None)
        )

        if current_sprint_id:
            base_query = base_query.where(Ticket.sprint_id == UUID(current_sprint_id))

        base_query = base_query.group_by(
            Ticket.suggested_assignee_name,
            Ticket.suggested_assignee_slack_id,
            Ticket.origin_type
        )

        result = await session.execute(base_query)
        rows = result.all()

        # Aggregate by engineer
        engineer_data = {}
        for row in rows:
            name = row[0]
            slack_id = row[1]
            origin = row[2]
            count = row[3]
            points = row[4]

            if name not in engineer_data:
                engineer_data[name] = {
                    "engineer_name": name,
                    "engineer_slack_id": slack_id,
                    "adhoc_tickets": 0,
                    "adhoc_points": 0,
                    "planned_tickets": 0,
                    "planned_points": 0,
                }

            if origin == "adhoc":
                engineer_data[name]["adhoc_tickets"] = count
                engineer_data[name]["adhoc_points"] = points
            else:
                engineer_data[name]["planned_tickets"] = count
                engineer_data[name]["planned_points"] = points

        # Get expertise map for top domains
        expertise_result = await session.execute(
            select(ExpertiseMap).order_by(ExpertiseMap.score.desc())
        )
        expertise_rows = expertise_result.scalars().all()

        # Map engineer -> top domain
        engineer_domains = {}
        for exp in expertise_rows:
            if exp.engineer_name not in engineer_domains:
                engineer_domains[exp.engineer_name] = exp.service_or_domain

        # Get last sprint adhoc points for trend comparison
        last_sprint_adhoc = {}
        if last_sprint_id:
            last_result = await session.execute(
                select(
                    Ticket.suggested_assignee_name,
                    func.coalesce(func.sum(Ticket.story_points), 0).label("adhoc_points")
                ).where(
                    Ticket.sprint_id == UUID(last_sprint_id),
                    Ticket.origin_type == "adhoc",
                    Ticket.suggested_assignee_name.isnot(None)
                ).group_by(Ticket.suggested_assignee_name)
            )
            for row in last_result.all():
                last_sprint_adhoc[row[0]] = row[1]

        # Build final engineer list
        engineers = []
        total_team_adhoc_points = 0
        engineers_with_adhoc = 0

        for name, data in engineer_data.items():
            total_points = data["adhoc_points"] + data["planned_points"]
            adhoc_percentage = (data["adhoc_points"] / total_points * 100) if total_points > 0 else 0.0

            last_adhoc = last_sprint_adhoc.get(name, 0)
            trend = "up" if data["adhoc_points"] > last_adhoc else "down" if data["adhoc_points"] < last_adhoc else "flat"

            total_team_adhoc_points += data["adhoc_points"]
            if data["adhoc_tickets"] > 0:
                engineers_with_adhoc += 1

            engineers.append({
                "engineer_name": name,
                "engineer_slack_id": data["engineer_slack_id"],
                "adhoc_tickets": data["adhoc_tickets"],
                "adhoc_points": data["adhoc_points"],
                "planned_tickets": data["planned_tickets"],
                "planned_points": data["planned_points"],
                "total_points": total_points,
                "adhoc_percentage": round(adhoc_percentage, 1),
                "top_domain": engineer_domains.get(name),
                "trend": trend,
                "last_sprint_adhoc_points": last_adhoc,
            })

        # Sort by adhoc points descending
        engineers.sort(key=lambda x: x["adhoc_points"], reverse=True)

        # Find most impacted
        most_impacted = engineers[0] if engineers else None

        # Team stats
        total_engineers = len(engineers)
        pct_with_adhoc = (engineers_with_adhoc / total_engineers * 100) if total_engineers > 0 else 0.0

        return {
            "engineers": engineers,
            "team_stats": {
                "total_adhoc_points": total_team_adhoc_points,
                "most_impacted_name": most_impacted["engineer_name"] if most_impacted else None,
                "most_impacted_points": most_impacted["adhoc_points"] if most_impacted else 0,
                "engineers_with_adhoc": engineers_with_adhoc,
                "total_engineers": total_engineers,
                "pct_carrying_adhoc": round(pct_with_adhoc, 0),
            }
        }


async def get_analytics_summary() -> dict:
    """Get full dashboard summary in a single call."""
    async with async_session() as session:
        # Get active sprint
        active_sprint_result = await session.execute(
            select(Sprint).where(Sprint.state == "active").limit(1)
        )
        active_sprint = active_sprint_result.scalar_one_or_none()

        # Get last closed sprint for comparison
        last_sprint_result = await session.execute(
            select(Sprint)
            .where(Sprint.state == "closed")
            .order_by(Sprint.end_date.desc())
            .limit(1)
        )
        last_sprint = last_sprint_result.scalar_one_or_none()

        # Current sprint breakdown
        current_breakdown = None
        if active_sprint:
            current_breakdown = await get_sprint_breakdown(str(active_sprint.id))

        # Trend data
        trend = await get_adhoc_trend(6)

        # Top source channels (current sprint)
        top_channels = []
        if active_sprint:
            top_channels = await get_top_source_channels(str(active_sprint.id), limit=3)

        # Top engineers by adhoc load (current sprint)
        top_engineers = []
        if active_sprint:
            all_engineers = await get_engineer_adhoc_load(str(active_sprint.id))
            top_engineers = all_engineers[:3]

        # Comparison to last sprint
        comparison = None
        if current_breakdown and last_sprint:
            current_pct = current_breakdown.get("adhoc_percentage", 0)
            last_pct = last_sprint.adhoc_percentage
            diff = current_pct - last_pct
            comparison = {
                "current_percentage": current_pct,
                "last_percentage": last_pct,
                "difference": round(diff, 1),
                "direction": "up" if diff > 0 else "down" if diff < 0 else "flat",
                "message": f"{'up' if diff > 0 else 'down'} {abs(diff):.1f}% from last sprint" if diff != 0 else "same as last sprint"
            }

        return {
            "current_sprint": current_breakdown,
            "trend": trend,
            "top_source_channels": top_channels,
            "top_engineers_adhoc_load": top_engineers,
            "comparison_to_last_sprint": comparison,
            "total_adhoc_this_sprint": current_breakdown.get("adhoc_count", 0) if current_breakdown else 0,
        }

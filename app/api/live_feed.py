from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AgentDecision, ChannelConfig, DetectedTask, SlackScan, SlackThread, Sprint, Ticket
from app.services.slack_client import get_slack_client
from app.workers.tasks import scan_live_slack_task

router = APIRouter()


class SlackScanStatusResponse(BaseModel):
    status: str
    scan_id: str | None
    started_at: datetime | None
    completed_at: datetime | None
    since_hours: int
    channels_scanned: int
    threads_found: int
    tickets_generated: int
    error_message: str | None


class SlackScanTriggerResponse(BaseModel):
    scan_id: str
    task_id: str
    status: str
    message: str


class LiveFeedBootstrapResponse(BaseModel):
    cleared: dict[str, int]
    scan_id: str
    task_id: str
    status: str
    message: str


async def _clear_live_feed_data(db: AsyncSession) -> dict[str, int]:
    """Delete only live (is_mock=False) data so demo seed data is preserved."""
    counts: dict[str, int] = {}

    for model, key in (
        (AgentDecision, "agent_decisions"),
        (Ticket, "tickets"),
        (Sprint, "sprints"),
    ):
        result = await db.execute(delete(model).where(model.is_mock == False))  # noqa: E712
        counts[key] = result.rowcount or 0

    # These models have no is_mock flag — always safe to clear (they're live-only)
    for model, key in (
        (DetectedTask, "detected_tasks"),
        (SlackThread, "slack_threads"),
        (SlackScan, "slack_scans"),
        (ChannelConfig, "channel_configs"),
    ):
        result = await db.execute(delete(model))
        counts[key] = result.rowcount or 0

    return counts


@router.post("/channels/sync")
async def sync_bot_channels(db: AsyncSession = Depends(get_db)):
    """Discover channels the bot can access and upsert them into channel configs."""
    slack_client = get_slack_client()
    try:
        workspace = slack_client.get_workspace_info()
        bot_channels = slack_client.list_accessible_channels()
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not workspace:
        raise HTTPException(status_code=400, detail="Slack returned empty workspace info")

    workspace_id = workspace.get("id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Slack workspace ID not available")

    registered = 0
    updated = 0
    synced_channels = []

    for channel in bot_channels:
        channel_id = channel.get("id")
        channel_name = channel.get("name")
        if not channel_id or not channel_name:
            continue

        result = await db.execute(
            select(ChannelConfig).where(ChannelConfig.channel_id == channel_id)
        )
        config = result.scalar_one_or_none()

        if config:
            config.channel_name = channel_name
            config.workspace_id = workspace_id
            updated += 1
        else:
            db.add(
                ChannelConfig(
                    channel_id=channel_id,
                    channel_name=channel_name,
                    workspace_id=workspace_id,
                    monitoring_active=True,
                )
            )
            registered += 1

        synced_channels.append(
            {
                "channel_id": channel_id,
                "channel_name": channel_name,
            }
        )

    await db.commit()

    return {
        "registered": registered,
        "updated": updated,
        "total_bot_channels": len(synced_channels),
        "channels": sorted(synced_channels, key=lambda c: c["channel_name"]),
    }


@router.get("/channels")
async def list_live_channels(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChannelConfig).order_by(ChannelConfig.channel_name.asc()))
    configs = result.scalars().all()
    return [
        {
            "channel_id": config.channel_id,
            "channel_name": config.channel_name or config.channel_id,
            "monitoring_active": config.monitoring_active,
            "min_replies": config.min_replies,
            "is_real": True,
        }
        for config in configs
    ]


@router.post("/bootstrap", response_model=LiveFeedBootstrapResponse)
async def bootstrap_live_feed(
    since_hours: int = Query(24, ge=1, le=168),
    force: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    """Replace demo operational data with real Slack sync + scan."""
    result = await db.execute(
        select(SlackScan).where(SlackScan.status.in_(["pending", "running"]))
    )
    active_scan = result.scalars().first()
    if active_scan:
        if not force:
            raise HTTPException(status_code=409, detail="A Slack scan is already running")
        active_scan.status = "failed"
        active_scan.error_message = "Overridden by force bootstrap"
        active_scan.completed_at = datetime.utcnow()
        await db.flush()

    cleared = await _clear_live_feed_data(db)

    slack_client = get_slack_client()
    try:
        workspace = slack_client.get_workspace_info()
        bot_channels = slack_client.list_accessible_channels()
    except RuntimeError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not workspace:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Slack returned empty workspace info")

    workspace_id = workspace.get("id")
    if not workspace_id:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Slack workspace ID not available")

    for channel in bot_channels:
        channel_id = channel.get("id")
        channel_name = channel.get("name")
        if not channel_id or not channel_name:
            continue

        db.add(
            ChannelConfig(
                channel_id=channel_id,
                channel_name=channel_name,
                workspace_id=workspace_id,
                monitoring_active=True,
            )
        )

    scan = SlackScan(status="pending", since_hours=since_hours)
    db.add(scan)
    await db.flush()

    celery_task = scan_live_slack_task.delay(str(scan.id), since_hours)
    scan.celery_task_id = celery_task.id
    await db.commit()

    return LiveFeedBootstrapResponse(
        cleared=cleared,
        scan_id=str(scan.id),
        task_id=celery_task.id,
        status=scan.status,
        message="Demo feed cleared, Slack channels synced, and workspace scan started",
    )


@router.post("/scan", response_model=SlackScanTriggerResponse)
async def trigger_scan(
    since_hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
):
    """Kick off a recent-history Slack scan across monitored channels."""
    result = await db.execute(
        select(SlackScan).where(SlackScan.status.in_(["pending", "running"]))
    )
    active_scan = result.scalars().first()
    if active_scan:
        raise HTTPException(status_code=409, detail="A Slack scan is already running")

    scan = SlackScan(status="pending", since_hours=since_hours)
    db.add(scan)
    await db.flush()

    celery_task = scan_live_slack_task.delay(str(scan.id), since_hours)
    scan.celery_task_id = celery_task.id
    await db.commit()
    await db.refresh(scan)

    return SlackScanTriggerResponse(
        scan_id=str(scan.id),
        task_id=celery_task.id,
        status=scan.status,
        message="Slack workspace scan started",
    )


SCAN_TIMEOUT_MINUTES = 5


@router.get("/scan/status", response_model=SlackScanStatusResponse)
async def scan_status(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SlackScan).order_by(SlackScan.started_at.desc()).limit(1)
    )
    scan = result.scalar_one_or_none()

    if not scan:
        return SlackScanStatusResponse(
            status="never",
            scan_id=None,
            started_at=None,
            completed_at=None,
            since_hours=24,
            channels_scanned=0,
            threads_found=0,
            tickets_generated=0,
            error_message=None,
        )

    # Auto-timeout stale scans that have been pending/running too long
    if scan.status in ("pending", "running") and scan.started_at:
        started_at = scan.started_at
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        age = datetime.now(timezone.utc) - started_at
        if age > timedelta(minutes=SCAN_TIMEOUT_MINUTES):
            scan.status = "failed"
            scan.error_message = (
                f"Scan timed out after {SCAN_TIMEOUT_MINUTES} minutes. "
                "Celery worker may not be running. Start it with: "
                "celery -A app.workers.celery_app worker --loglevel=info"
            )
            scan.completed_at = datetime.now(timezone.utc)
            await db.commit()

    return SlackScanStatusResponse(
        status=scan.status,
        scan_id=str(scan.id),
        started_at=scan.started_at,
        completed_at=scan.completed_at,
        since_hours=scan.since_hours,
        channels_scanned=scan.channels_scanned,
        threads_found=scan.threads_found,
        tickets_generated=scan.tickets_generated,
        error_message=scan.error_message,
    )

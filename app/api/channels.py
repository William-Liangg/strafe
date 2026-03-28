from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ChannelConfig

router = APIRouter()


class ChannelConfigCreate(BaseModel):
    channel_id: str
    channel_name: str | None = None
    workspace_id: str
    sensitivity: float = 0.7
    monitoring_active: bool = True
    min_replies: int = 2


class ChannelConfigUpdate(BaseModel):
    sensitivity: float | None = None
    monitoring_active: bool | None = None
    min_replies: int | None = None


@router.get("/")
async def list_channel_configs(db: AsyncSession = Depends(get_db)):
    """List all channel configurations."""
    result = await db.execute(select(ChannelConfig))
    configs = result.scalars().all()

    return [
        {
            "channel_id": c.channel_id,
            "channel_name": c.channel_name,
            "workspace_id": c.workspace_id,
            "sensitivity": c.sensitivity,
            "monitoring_active": c.monitoring_active,
            "min_replies": c.min_replies,
        }
        for c in configs
    ]


@router.post("/")
async def create_channel_config(
    config: ChannelConfigCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new channel configuration."""
    existing = await db.execute(
        select(ChannelConfig).where(ChannelConfig.channel_id == config.channel_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Channel already configured")

    channel_config = ChannelConfig(**config.model_dump())
    db.add(channel_config)
    await db.commit()

    return {
        "channel_id": channel_config.channel_id,
        "channel_name": channel_config.channel_name,
        "sensitivity": channel_config.sensitivity,
        "monitoring_active": channel_config.monitoring_active,
        "min_replies": channel_config.min_replies,
    }


@router.patch("/{channel_id}")
async def update_channel_config(
    channel_id: str,
    updates: ChannelConfigUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a channel configuration."""
    result = await db.execute(
        select(ChannelConfig).where(ChannelConfig.channel_id == channel_id)
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(status_code=404, detail="Channel not found")

    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(config, key, value)

    await db.commit()

    return {
        "channel_id": config.channel_id,
        "channel_name": config.channel_name,
        "sensitivity": config.sensitivity,
        "monitoring_active": config.monitoring_active,
        "min_replies": config.min_replies,
    }

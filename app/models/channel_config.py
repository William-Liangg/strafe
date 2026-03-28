from sqlalchemy import String, Float, Boolean, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ChannelConfig(Base):
    __tablename__ = "channel_configs"

    channel_id: Mapped[str] = mapped_column(String, primary_key=True)
    channel_name: Mapped[str | None] = mapped_column(String, nullable=True)
    workspace_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    sensitivity: Mapped[float] = mapped_column(Float, default=0.7)
    monitoring_active: Mapped[bool] = mapped_column(Boolean, default=True)
    min_replies: Mapped[int] = mapped_column(Integer, default=2)

    # Auto-approve settings
    auto_approve_threshold: Mapped[float] = mapped_column(Float, default=0.85)
    auto_approve_max_points: Mapped[int] = mapped_column(Integer, default=3)
    manager_slack_id: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

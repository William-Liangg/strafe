import uuid
from sqlalchemy import String, Integer, DateTime, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class SlackThread(Base):
    __tablename__ = "slack_threads"
    __table_args__ = (
        UniqueConstraint("thread_ts", "channel_id", name="uq_thread_channel"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    thread_ts: Mapped[str] = mapped_column(String, nullable=False)
    channel_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    workspace_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    reply_count: Mapped[int] = mapped_column(Integer, default=0)
    last_analyzed_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationship to detected tasks
    detected_tasks: Mapped[list["DetectedTask"]] = relationship(
        "DetectedTask", back_populates="thread"
    )

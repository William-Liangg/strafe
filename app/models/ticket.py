import uuid
from sqlalchemy import String, Integer, Float, DateTime, func, ForeignKey, Text, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, ARRAY
import enum

from app.database import Base


class TicketPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TicketStatus(str, enum.Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    REJECTED = "rejected"
    CREATED = "created"


class OriginType(str, enum.Enum):
    ADHOC = "adhoc"
    PLANNED = "planned"


class TriggerMode(str, enum.Enum):
    AUTOMATIC = "automatic"
    SLASH_COMMAND = "slash_command"
    EMOJI_REACTION = "emoji_reaction"


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    detected_task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("detected_tasks.id"), nullable=True
    )

    # Jira fields
    jira_ticket_id: Mapped[str | None] = mapped_column(String, nullable=True)
    jira_ticket_url: Mapped[str | None] = mapped_column(String, nullable=True)

    # Ticket content
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[TicketPriority] = mapped_column(
        Enum(TicketPriority, values_callable=lambda x: [e.value for e in x]),
        nullable=False, default=TicketPriority.MEDIUM
    )
    labels: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=[])
    story_points: Mapped[int] = mapped_column(Integer, nullable=False, default=3)

    # Assignee suggestion
    suggested_assignee_slack_id: Mapped[str | None] = mapped_column(String, nullable=True)
    suggested_assignee_name: Mapped[str | None] = mapped_column(String, nullable=True)
    assignee_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Source tracking
    source_thread_url: Mapped[str | None] = mapped_column(String, nullable=True)
    source_channel_id: Mapped[str | None] = mapped_column(String, nullable=True)
    source_channel_name: Mapped[str | None] = mapped_column(String, nullable=True)
    source_thread_ts: Mapped[str | None] = mapped_column(String, nullable=True)

    # Classification
    origin_type: Mapped[OriginType] = mapped_column(
        Enum(OriginType, values_callable=lambda x: [e.value for e in x]),
        nullable=False, default=OriginType.ADHOC
    )
    trigger_mode: Mapped[TriggerMode] = mapped_column(
        Enum(TriggerMode, values_callable=lambda x: [e.value for e in x]),
        nullable=False, default=TriggerMode.AUTOMATIC
    )
    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False, default=TicketStatus.DRAFT
    )

    # Rejection tracking
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationship to detected task
    detected_task: Mapped["DetectedTask"] = relationship(
        "DetectedTask", back_populates="ticket"
    )

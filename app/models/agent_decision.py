import enum
from uuid import UUID
from datetime import datetime
from sqlalchemy import String, Float, Boolean, Integer, DateTime, Text, ForeignKey, Enum, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from app.database import Base


class AgentAction(str, enum.Enum):
    AUTO_ASSIGNED = "auto_assigned"
    FLAGGED_FOR_REVIEW = "flagged_for_review"
    DISMISSED = "dismissed"
    PATTERN_MATCHED = "pattern_matched"
    POST_MORTEM_GENERATED = "post_mortem_generated"
    SPRINT_HEALTH_REPORTED = "sprint_health_reported"


class AgentDecision(Base):
    __tablename__ = "agent_decisions"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    ticket_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="SET NULL"),
        nullable=True,
    )
    detected_task_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("detected_tasks.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[AgentAction] = mapped_column(
        Enum(
            AgentAction,
            name="agent_action",
            create_type=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    reasoning: Mapped[str] = mapped_column(Text, nullable=False)
    assignee_name: Mapped[str | None] = mapped_column(String, nullable=True)
    assignee_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    jira_ticket_id: Mapped[str | None] = mapped_column(String, nullable=True)
    channel_name: Mapped[str] = mapped_column(String, nullable=False)
    story_points: Mapped[int | None] = mapped_column(Integer, nullable=True)
    auto_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_mock: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text('false'))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    ticket = relationship("Ticket", back_populates="agent_decision", uselist=False)
    detected_task = relationship("DetectedTask", back_populates="agent_decision", uselist=False)

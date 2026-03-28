import uuid
from sqlalchemy import String, Float, DateTime, func, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.database import Base


class DetectedTask(Base):
    __tablename__ = "detected_tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    thread_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("slack_threads.id"), nullable=False
    )
    classification: Mapped[str] = mapped_column(
        String, nullable=False
    )  # task, bug, feature_request, question, conversation
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str | None] = mapped_column(
        String, nullable=True
    )  # high, medium, low
    raw_claude_response: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(
        String, default="pending"
    )  # pending, approved, dismissed, converted
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationship back to thread
    thread: Mapped["SlackThread"] = relationship(
        "SlackThread", back_populates="detected_tasks"
    )

    # Relationship to ticket
    ticket: Mapped["Ticket"] = relationship(
        "Ticket", back_populates="detected_task", uselist=False
    )

    # Relationship to agent decision
    agent_decision: Mapped["AgentDecision"] = relationship(
        "AgentDecision", back_populates="detected_task", uselist=False
    )

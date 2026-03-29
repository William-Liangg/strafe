import uuid
import enum
from sqlalchemy import Boolean, String, Integer, Float, DateTime, func, Enum, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class SprintState(str, enum.Enum):
    ACTIVE = "active"
    CLOSED = "closed"
    FUTURE = "future"


class Sprint(Base):
    __tablename__ = "sprints"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    jira_sprint_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    state: Mapped[SprintState] = mapped_column(
        Enum(SprintState, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=SprintState.FUTURE,
    )
    start_date: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    end_date: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Computed metrics (stored on sprint completion)
    adhoc_count: Mapped[int] = mapped_column(Integer, default=0)
    planned_count: Mapped[int] = mapped_column(Integer, default=0)
    adhoc_percentage: Mapped[float] = mapped_column(Float, default=0.0)
    top_source_channel: Mapped[str | None] = mapped_column(String, nullable=True)
    total_story_points_adhoc: Mapped[int] = mapped_column(Integer, default=0)
    total_story_points_planned: Mapped[int] = mapped_column(Integer, default=0)

    is_mock: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text('false'))

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationship to tickets
    tickets: Mapped[list["Ticket"]] = relationship("Ticket", back_populates="sprint")

import uuid
from sqlalchemy import String, Integer, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class GithubSync(Base):
    __tablename__ = "github_syncs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    celery_task_id: Mapped[str | None] = mapped_column(String, nullable=True)
    started_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    synced_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    contributors_analyzed: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    domains_extracted: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    status: Mapped[str] = mapped_column(String, nullable=False, default="running")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

import uuid
from sqlalchemy import Boolean, String, Integer, Float, DateTime, func, text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class ExpertiseMap(Base):
    __tablename__ = "expertise_map"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    engineer_slack_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    engineer_name: Mapped[str] = mapped_column(String, nullable=False)
    service_or_domain: Mapped[str] = mapped_column(String, nullable=False, index=True)
    score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    pr_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_active: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    is_mock: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text('false'))

    # GitHub-derived fields (populated by /expertise/sync)
    github_login: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)

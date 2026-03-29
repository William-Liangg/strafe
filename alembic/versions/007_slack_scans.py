"""add slack scans table

Revision ID: 007_slack_scans
Revises: 005_expertise_github_sync
Create Date: 2026-03-28 22:40:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "007_slack_scans"
down_revision = "005_expertise_github_sync"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "slack_scans",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("celery_task_id", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("since_hours", sa.Integer(), nullable=False),
        sa.Column("channels_scanned", sa.Integer(), nullable=False),
        sa.Column("threads_found", sa.Integer(), nullable=False),
        sa.Column("tickets_generated", sa.Integer(), nullable=False),
        sa.Column("error_message", sa.String(), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_slack_scans_celery_task_id"),
        "slack_scans",
        ["celery_task_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_slack_scans_celery_task_id"), table_name="slack_scans")
    op.drop_table("slack_scans")

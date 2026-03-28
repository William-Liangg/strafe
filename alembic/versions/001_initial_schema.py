"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Channel configs table
    op.create_table(
        "channel_configs",
        sa.Column("channel_id", sa.String(), nullable=False),
        sa.Column("channel_name", sa.String(), nullable=True),
        sa.Column("workspace_id", sa.String(), nullable=False),
        sa.Column("sensitivity", sa.Float(), nullable=False, server_default="0.7"),
        sa.Column("monitoring_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("min_replies", sa.Integer(), nullable=False, server_default="2"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("channel_id"),
    )
    op.create_index("ix_channel_configs_workspace_id", "channel_configs", ["workspace_id"])

    # Slack threads table
    op.create_table(
        "slack_threads",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("thread_ts", sa.String(), nullable=False),
        sa.Column("channel_id", sa.String(), nullable=False),
        sa.Column("workspace_id", sa.String(), nullable=False),
        sa.Column("reply_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_analyzed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("thread_ts", "channel_id", name="uq_thread_channel"),
    )
    op.create_index("ix_slack_threads_channel_id", "slack_threads", ["channel_id"])
    op.create_index("ix_slack_threads_workspace_id", "slack_threads", ["workspace_id"])

    # Detected tasks table
    op.create_table(
        "detected_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("thread_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("classification", sa.String(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("priority", sa.String(), nullable=True),
        sa.Column("raw_claude_response", postgresql.JSONB(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["thread_id"], ["slack_threads.id"]),
    )


def downgrade() -> None:
    op.drop_table("detected_tasks")
    op.drop_index("ix_slack_threads_workspace_id", table_name="slack_threads")
    op.drop_index("ix_slack_threads_channel_id", table_name="slack_threads")
    op.drop_table("slack_threads")
    op.drop_index("ix_channel_configs_workspace_id", table_name="channel_configs")
    op.drop_table("channel_configs")

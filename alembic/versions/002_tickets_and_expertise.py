"""Add tickets and expertise_map tables

Revision ID: 002
Revises: 001
Create Date: 2026-03-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum types (IF NOT EXISTS for idempotency)
    op.execute("DO $$ BEGIN CREATE TYPE ticketpriority AS ENUM ('low', 'medium', 'high', 'critical'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE ticketstatus AS ENUM ('draft', 'approved', 'rejected', 'created'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE origintype AS ENUM ('adhoc', 'planned'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE triggermode AS ENUM ('automatic', 'slash_command', 'emoji_reaction'); EXCEPTION WHEN duplicate_object THEN null; END $$;")

    # Create tickets table
    op.create_table(
        "tickets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("detected_task_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("jira_ticket_id", sa.String(), nullable=True),
        sa.Column("jira_ticket_url", sa.String(), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("priority", postgresql.ENUM('low', 'medium', 'high', 'critical', name='ticketpriority', create_type=False), nullable=False, server_default='medium'),
        sa.Column("labels", postgresql.ARRAY(sa.String()), nullable=False, server_default='{}'),
        sa.Column("story_points", sa.Integer(), nullable=False, server_default='3'),
        sa.Column("suggested_assignee_slack_id", sa.String(), nullable=True),
        sa.Column("suggested_assignee_name", sa.String(), nullable=True),
        sa.Column("assignee_reason", sa.Text(), nullable=True),
        sa.Column("source_thread_url", sa.String(), nullable=True),
        sa.Column("source_channel_id", sa.String(), nullable=True),
        sa.Column("source_channel_name", sa.String(), nullable=True),
        sa.Column("source_thread_ts", sa.String(), nullable=True),
        sa.Column("origin_type", postgresql.ENUM('adhoc', 'planned', name='origintype', create_type=False), nullable=False, server_default='adhoc'),
        sa.Column("trigger_mode", postgresql.ENUM('automatic', 'slash_command', 'emoji_reaction', name='triggermode', create_type=False), nullable=False, server_default='automatic'),
        sa.Column("status", postgresql.ENUM('draft', 'approved', 'rejected', 'created', name='ticketstatus', create_type=False), nullable=False, server_default='draft'),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["detected_task_id"], ["detected_tasks.id"]),
    )

    # Create expertise_map table
    op.create_table(
        "expertise_map",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("engineer_slack_id", sa.String(), nullable=False),
        sa.Column("engineer_name", sa.String(), nullable=False),
        sa.Column("service_or_domain", sa.String(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False, server_default='0.0'),
        sa.Column("pr_count", sa.Integer(), nullable=False, server_default='0'),
        sa.Column("last_active", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_expertise_map_engineer_slack_id", "expertise_map", ["engineer_slack_id"])
    op.create_index("ix_expertise_map_service_or_domain", "expertise_map", ["service_or_domain"])


def downgrade() -> None:
    op.drop_index("ix_expertise_map_service_or_domain", table_name="expertise_map")
    op.drop_index("ix_expertise_map_engineer_slack_id", table_name="expertise_map")
    op.drop_table("expertise_map")
    op.drop_table("tickets")
    op.execute("DROP TYPE triggermode")
    op.execute("DROP TYPE origintype")
    op.execute("DROP TYPE ticketstatus")
    op.execute("DROP TYPE ticketpriority")

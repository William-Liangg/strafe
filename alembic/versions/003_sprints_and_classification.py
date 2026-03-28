"""Add sprints table and sprint_id to tickets

Revision ID: 003
Revises: 002
Create Date: 2026-03-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "003_sprints_and_classification"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create sprint state enum
    op.execute("DO $$ BEGIN CREATE TYPE sprintstate AS ENUM ('active', 'closed', 'future'); EXCEPTION WHEN duplicate_object THEN null; END $$;")

    # Create sprints table
    op.create_table(
        "sprints",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("jira_sprint_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("state", postgresql.ENUM('active', 'closed', 'future', name='sprintstate', create_type=False), nullable=False, server_default='future'),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("adhoc_count", sa.Integer(), nullable=False, server_default='0'),
        sa.Column("planned_count", sa.Integer(), nullable=False, server_default='0'),
        sa.Column("adhoc_percentage", sa.Float(), nullable=False, server_default='0.0'),
        sa.Column("top_source_channel", sa.String(), nullable=True),
        sa.Column("total_story_points_adhoc", sa.Integer(), nullable=False, server_default='0'),
        sa.Column("total_story_points_planned", sa.Integer(), nullable=False, server_default='0'),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("jira_sprint_id", name="uq_sprints_jira_sprint_id"),
    )
    op.create_index("ix_sprints_state", "sprints", ["state"])

    # Add sprint_id and completed_at to tickets
    op.add_column("tickets", sa.Column("sprint_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("tickets", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key("fk_tickets_sprint_id", "tickets", "sprints", ["sprint_id"], ["id"])
    op.create_index("ix_tickets_sprint_id", "tickets", ["sprint_id"])


def downgrade() -> None:
    op.drop_index("ix_tickets_sprint_id", table_name="tickets")
    op.drop_constraint("fk_tickets_sprint_id", "tickets", type_="foreignkey")
    op.drop_column("tickets", "completed_at")
    op.drop_column("tickets", "sprint_id")
    op.drop_index("ix_sprints_state", table_name="sprints")
    op.drop_table("sprints")
    op.execute("DROP TYPE IF EXISTS sprintstate")

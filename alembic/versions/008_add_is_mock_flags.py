"""add is_mock columns used for demo/live separation

Revision ID: 008_add_is_mock_flags
Revises: 007_slack_scans
Create Date: 2026-03-29 08:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "008_add_is_mock_flags"
down_revision = "007_slack_scans"
branch_labels = None
depends_on = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    for table_name in ("tickets", "agent_decisions", "sprints", "expertise_map"):
        if not _has_column(table_name, "is_mock"):
            op.add_column(
                table_name,
                sa.Column(
                    "is_mock",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.text("false"),
                ),
            )


def downgrade() -> None:
    for table_name in ("expertise_map", "sprints", "agent_decisions", "tickets"):
        if _has_column(table_name, "is_mock"):
            op.drop_column(table_name, "is_mock")

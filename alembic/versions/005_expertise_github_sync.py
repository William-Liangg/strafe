"""Add github_login/avatar_url to expertise_map and create github_syncs table

Revision ID: 005_expertise_github_sync
Revises: 004_agent_decisions
Create Date: 2026-03-28 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '005_expertise_github_sync'
down_revision = '004_agent_decisions'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    # Add GitHub fields to expertise_map
    expertise_columns = {
        column["name"] for column in inspector.get_columns("expertise_map")
    }
    expertise_indexes = {
        index["name"] for index in inspector.get_indexes("expertise_map")
    }

    if "github_login" not in expertise_columns:
        op.add_column(
            'expertise_map',
            sa.Column('github_login', sa.String(), nullable=True)
        )
    if "avatar_url" not in expertise_columns:
        op.add_column(
            'expertise_map',
            sa.Column('avatar_url', sa.String(), nullable=True)
        )
    if 'ix_expertise_map_github_login' not in expertise_indexes:
        op.create_index('ix_expertise_map_github_login', 'expertise_map', ['github_login'])

    # Create github_syncs table
    if 'github_syncs' not in table_names:
        op.create_table(
            'github_syncs',
            sa.Column(
                'id',
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text('gen_random_uuid()'),
            ),
            sa.Column('celery_task_id', sa.String(), nullable=True),
            sa.Column(
                'started_at',
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column('synced_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                'contributors_analyzed',
                sa.Integer(),
                nullable=False,
                server_default='0',
            ),
            sa.Column(
                'domains_extracted',
                sa.Integer(),
                nullable=False,
                server_default='0',
            ),
            sa.Column('status', sa.String(), nullable=False, server_default='running'),
            sa.Column('error_message', sa.Text(), nullable=True),
        )

    github_sync_indexes = {
        index["name"] for index in inspector.get_indexes("github_syncs")
    } if 'github_syncs' in table_names else set()
    if 'ix_github_syncs_started_at' not in github_sync_indexes:
        op.create_index('ix_github_syncs_started_at', 'github_syncs', ['started_at'])


def downgrade() -> None:
    op.drop_index('ix_github_syncs_started_at', 'github_syncs')
    op.drop_table('github_syncs')
    op.drop_index('ix_expertise_map_github_login', 'expertise_map')
    op.drop_column('expertise_map', 'avatar_url')
    op.drop_column('expertise_map', 'github_login')

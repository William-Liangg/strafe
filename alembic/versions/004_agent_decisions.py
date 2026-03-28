"""Add agent decisions table and channel config fields for auto-approve

Revision ID: 004_agent_decisions
Revises: 003_sprints_and_classification
Create Date: 2026-03-28 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '004_agent_decisions'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to channel_configs for auto-approve settings
    op.add_column(
        'channel_configs',
        sa.Column('auto_approve_threshold', sa.Float(), nullable=False, server_default='0.85')
    )
    op.add_column(
        'channel_configs',
        sa.Column('auto_approve_max_points', sa.Integer(), nullable=False, server_default='3')
    )
    op.add_column(
        'channel_configs',
        sa.Column('manager_slack_id', sa.String(), nullable=True)
    )

    # Create agent_action enum type
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE agent_action AS ENUM (
                'auto_assigned',
                'flagged_for_review',
                'dismissed',
                'pattern_matched'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create agent_decisions table
    op.create_table(
        'agent_decisions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('ticket_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tickets.id', ondelete='SET NULL'), nullable=True),
        sa.Column('detected_task_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('detected_tasks.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action', postgresql.ENUM('auto_assigned', 'flagged_for_review', 'dismissed', 'pattern_matched', name='agent_action', create_type=False), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('reasoning', sa.Text(), nullable=False),
        sa.Column('assignee_name', sa.String(), nullable=True),
        sa.Column('assignee_reason', sa.Text(), nullable=True),
        sa.Column('jira_ticket_id', sa.String(), nullable=True),
        sa.Column('channel_name', sa.String(), nullable=False),
        sa.Column('story_points', sa.Integer(), nullable=True),
        sa.Column('auto_approved', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Create indexes for efficient querying
    op.create_index('ix_agent_decisions_action', 'agent_decisions', ['action'])
    op.create_index('ix_agent_decisions_created_at', 'agent_decisions', ['created_at'])
    op.create_index('ix_agent_decisions_ticket_id', 'agent_decisions', ['ticket_id'])


def downgrade() -> None:
    op.drop_index('ix_agent_decisions_ticket_id', 'agent_decisions')
    op.drop_index('ix_agent_decisions_created_at', 'agent_decisions')
    op.drop_index('ix_agent_decisions_action', 'agent_decisions')
    op.drop_table('agent_decisions')
    op.execute('DROP TYPE IF EXISTS agent_action')
    op.drop_column('channel_configs', 'manager_slack_id')
    op.drop_column('channel_configs', 'auto_approve_max_points')
    op.drop_column('channel_configs', 'auto_approve_threshold')

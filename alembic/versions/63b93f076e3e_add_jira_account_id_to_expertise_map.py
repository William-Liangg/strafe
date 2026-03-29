"""add_jira_account_id_to_expertise_map

Revision ID: 63b93f076e3e
Revises: 749841fdcf4d
Create Date: 2026-03-29 02:25:24.143240

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '63b93f076e3e'
down_revision: Union[str, None] = '749841fdcf4d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('expertise_map', sa.Column('jira_account_id', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('expertise_map', 'jira_account_id')

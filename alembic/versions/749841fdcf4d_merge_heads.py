"""merge_heads

Revision ID: 749841fdcf4d
Revises: 005_expertise_github_sync, 31b5ef1ff824
Create Date: 2026-03-29 02:25:18.118195

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '749841fdcf4d'
down_revision: Union[str, None] = ('005_expertise_github_sync', '31b5ef1ff824')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

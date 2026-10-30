"""add_loan_code_and_pickup_deadline

Revision ID: f3b6a2c9e7d1
Revises: a1c7e9f3d8b2
Create Date: 2026-10-29 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f3b6a2c9e7d1'
down_revision: Union[str, Sequence[str], None] = 'a1c7e9f3d8b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('loans', sa.Column('loan_code', sa.String(length=30), nullable=True))
    op.add_column('loans', sa.Column('pickup_deadline', sa.TIMESTAMP(), nullable=True))
    op.create_unique_constraint('uq_loans_loan_code', 'loans', ['loan_code'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('uq_loans_loan_code', 'loans', type_='unique')
    op.drop_column('loans', 'pickup_deadline')
    op.drop_column('loans', 'loan_code')

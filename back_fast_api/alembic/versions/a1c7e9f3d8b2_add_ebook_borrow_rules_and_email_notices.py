"""add_ebook_borrow_rules_and_email_notices

Revision ID: a1c7e9f3d8b2
Revises: db80b864d7c7
Create Date: 2026-10-24 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1c7e9f3d8b2'
down_revision: Union[str, Sequence[str], None] = 'db80b864d7c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('ebooks', sa.Column('preview_pages', sa.Integer(), server_default='10', nullable=False))
    op.add_column('ebooks', sa.Column('borrow_days', sa.Integer(), server_default='14', nullable=False))

    op.create_table(
        'email_notices',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('event_key', sa.String(length=200), nullable=False),
        sa.Column('recipient', sa.String(length=255), nullable=False),
        sa.Column('sent_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('event_key'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('email_notices')
    op.drop_column('ebooks', 'borrow_days')
    op.drop_column('ebooks', 'preview_pages')

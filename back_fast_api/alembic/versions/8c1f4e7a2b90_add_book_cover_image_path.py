"""add book cover image path

Revision ID: 8c1f4e7a2b90
Revises: d4b2f9e233ef
Create Date: 2026-10-05
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8c1f4e7a2b90"
down_revision: Union[str, Sequence[str], None] = "d4b2f9e233ef"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "books",
        sa.Column("cover_image_path", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("books", "cover_image_path")

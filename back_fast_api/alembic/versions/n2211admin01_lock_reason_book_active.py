"""UC13 lock_reason + UC09 soft-delete books.is_active.

Revision ID: n2211admin01
Revises: n1311wallet01
"""
from alembic import op
import sqlalchemy as sa

revision = "n2211admin01"
down_revision = "n1311wallet01"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    user_cols = {c["name"] for c in sa.inspect(bind).get_columns("users")}
    if "lock_reason" not in user_cols:
        op.add_column("users", sa.Column("lock_reason", sa.Text(), nullable=True))

    book_cols = {c["name"] for c in sa.inspect(bind).get_columns("books")}
    if "is_active" not in book_cols:
        op.add_column(
            "books",
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        )


def downgrade():
    bind = op.get_bind()
    book_cols = {c["name"] for c in sa.inspect(bind).get_columns("books")}
    if "is_active" in book_cols:
        op.drop_column("books", "is_active")

    user_cols = {c["name"] for c in sa.inspect(bind).get_columns("users")}
    if "lock_reason" in user_cols:
        op.drop_column("users", "lock_reason")

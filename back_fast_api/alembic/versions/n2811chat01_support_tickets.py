"""Chatbot: bảng support_tickets (phiếu hỗ trợ chuyển cho thủ thư).

Revision ID: n2811chat01
Revises: n2711srs02
"""
from alembic import op
import sqlalchemy as sa

revision = "n2811chat01"
down_revision = "n2711srs02"
branch_labels = None
depends_on = None


def upgrade():
    if sa.inspect(op.get_bind()).has_table("support_tickets"):
        return
    op.create_table(
        "support_tickets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_code", sa.String(50), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("reply", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), server_default="OPEN", nullable=False),
        sa.Column("replied_by", sa.String(50), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
        sa.Column("replied_at", sa.TIMESTAMP(), nullable=True),
        sa.CheckConstraint("status IN ('OPEN', 'ANSWERED')", name="chk_support_ticket_status"),
        sa.ForeignKeyConstraint(["user_code"], ["users.user_code"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["replied_by"], ["users.user_code"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_support_tickets_user_code", "support_tickets", ["user_code"])
    op.create_index("ix_support_tickets_status", "support_tickets", ["status"])


def downgrade():
    op.drop_table("support_tickets")

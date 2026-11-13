"""UC16 E4: user được admin gán cho giao dịch chưa khớp.

Revision ID: n1311wallet01
Revises: c2d8f1a4b6e9
"""
from alembic import op
import sqlalchemy as sa

revision = "n1311wallet01"
down_revision = "c2d8f1a4b6e9"
branch_labels = None
depends_on = None


def upgrade():
    cols = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("unmatched_tx")}
    if "assigned_user_code" not in cols:
        op.add_column("unmatched_tx", sa.Column("assigned_user_code", sa.String(50), nullable=True))
        op.create_foreign_key("fk_unmatched_tx_assigned_user", "unmatched_tx", "users",
                              ["assigned_user_code"], ["user_code"], ondelete="RESTRICT")
        op.create_index("ix_unmatched_tx_assigned_user_code", "unmatched_tx", ["assigned_user_code"])


def downgrade():
    op.drop_index("ix_unmatched_tx_assigned_user_code", table_name="unmatched_tx")
    op.drop_constraint("fk_unmatched_tx_assigned_user", "unmatched_tx", type_="foreignkey")
    op.drop_column("unmatched_tx", "assigned_user_code")

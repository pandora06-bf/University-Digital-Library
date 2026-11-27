"""SRS: waitlists.user_code ON DELETE RESTRICT (trước là CASCADE).

Xóa bạn đọc không được âm thầm xóa luôn hàng đợi đặt trước; giống loans/fines đang RESTRICT.

Revision ID: n2711srs02
Revises: n2711srs01
"""
from alembic import op
import sqlalchemy as sa

revision = "n2711srs02"
down_revision = "n2711srs01"
branch_labels = None
depends_on = None


def _user_fk_name(bind):
    for fk in sa.inspect(bind).get_foreign_keys("waitlists"):
        if fk["constrained_columns"] == ["user_code"]:
            return fk["name"]
    return None


def _set_ondelete(ondelete):
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    name = _user_fk_name(bind) or "waitlists_user_code_fkey"
    op.drop_constraint(name, "waitlists", type_="foreignkey")
    op.create_foreign_key("waitlists_user_code_fkey", "waitlists", "users",
                          ["user_code"], ["user_code"], ondelete=ondelete)


def upgrade():
    _set_ondelete("RESTRICT")


def downgrade():
    _set_ondelete("CASCADE")

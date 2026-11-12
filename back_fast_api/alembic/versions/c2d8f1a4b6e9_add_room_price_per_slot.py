"""add_room_price_per_slot

Revision ID: c2d8f1a4b6e9
Revises: f3b6a2c9e7d1
Create Date: 2026-11-12 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "c2d8f1a4b6e9"
down_revision: Union[str, Sequence[str], None] = "f3b6a2c9e7d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Giá mỗi khung giờ (VNĐ) theo 2B-21; cần cho 3-10 trừ phí đặt phòng.
    # Mặc định 20.000đ cho các phòng đã tạo trước đó, Admin chỉnh lại qua PUT /api/admin/rooms/{room_id}.
    op.add_column(
        "rooms",
        sa.Column("price_per_slot", sa.Integer(), server_default="20000", nullable=False),
    )
    op.create_check_constraint(
        "chk_room_price_per_slot_positive",
        "rooms",
        "price_per_slot > 0",
    )


def downgrade() -> None:
    op.drop_constraint("chk_room_price_per_slot_positive", "rooms", type_="check")
    op.drop_column("rooms", "price_per_slot")

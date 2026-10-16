"""Add book price and normalize fine payment methods.

Revision ID: b71e91c2f305
Revises: 506a44440b24
Create Date: 2026-10-15
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b71e91c2f305"
down_revision: Union[str, Sequence[str], None] = "506a44440b24"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "books",
        sa.Column("price", sa.Integer(), server_default="0", nullable=False),
    )
    op.create_check_constraint(
        "chk_book_price_nonnegative",
        "books",
        "price >= 0",
    )

    op.execute(
        """
        UPDATE fine_payments
        SET payment_method = CASE UPPER(TRIM(payment_method))
            WHEN 'CASH' THEN 'CASH'
            WHEN 'WALLET' THEN 'WALLET'
            WHEN 'BANK_TRANSFER' THEN 'WALLET'
            ELSE payment_method
        END
        WHERE payment_method <> UPPER(TRIM(payment_method))
           OR UPPER(TRIM(payment_method)) = 'BANK_TRANSFER'
        """
    )
    op.create_check_constraint(
        "chk_fine_payment_method",
        "fine_payments",
        "payment_method IN ('CASH', 'WALLET')",
    )


def downgrade() -> None:
    op.drop_constraint("chk_fine_payment_method", "fine_payments", type_="check")
    op.drop_constraint("chk_book_price_nonnegative", "books", type_="check")
    op.drop_column("books", "price")

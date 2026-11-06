"""Restore missing Sprint 2 entities on existing 06/11 database.

Revision ID: n0611repair01
Revises: f3b6a2c9e7d1

Does not delete business records. Restore only confirmed missing Sprint 2
schema objects. It is a reconciliation migration, not a replacement for the
original db80b864d7c7 migration.
"""
from alembic import op
import sqlalchemy as sa

revision = "n0611repair01"
down_revision = "f3b6a2c9e7d1"
branch_labels = None
depends_on = None


def _index_names(table):
    return {idx["name"] for idx in sa.inspect(op.get_bind()).get_indexes(table)}


def upgrade():
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("rooms"):
        op.create_table('rooms',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('room_name', sa.String(length=100), nullable=False),
        sa.Column('capacity', sa.Integer(), nullable=False),
        sa.Column('room_type', sa.String(length=50), server_default='STUDY', nullable=False),
        sa.Column('floor', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('capacity > 0', name='chk_room_capacity_positive'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('room_name')
        )

    if not inspector.has_table("room_bookings"):
        op.create_table('room_bookings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('room_id', sa.Integer(), nullable=False),
        sa.Column('user_code', sa.String(length=50), nullable=False),
        sa.Column('booking_date', sa.Date(), nullable=False),
        sa.Column('slot_start', sa.Time(), nullable=False),
        sa.Column('slot_end', sa.Time(), nullable=False),
        sa.Column('status', sa.String(length=30), server_default='CONFIRMED', nullable=False),
        sa.Column('checkin_time', sa.TIMESTAMP(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['room_id'], ['rooms.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_code'], ['users.user_code'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
        )

    if "ix_room_bookings_room_id" not in _index_names("room_bookings"):
        op.create_index(op.f('ix_room_bookings_room_id'), 'room_bookings', ['room_id'], unique=False)

    if "ix_room_bookings_user_code" not in _index_names("room_bookings"):
        op.create_index(op.f('ix_room_bookings_user_code'), 'room_bookings', ['user_code'], unique=False)

    if "uq_room_booking_active_slot" not in _index_names("room_bookings"):
        op.create_index('uq_room_booking_active_slot', 'room_bookings', ['room_id', 'booking_date', 'slot_start'], unique=True, postgresql_where="status IN ('CONFIRMED', 'CHECKED_IN')")

    if not inspector.has_table("top_ups"):
        op.create_table('top_ups',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_code', sa.String(length=50), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('pay_code', sa.String(length=50), nullable=False),
        sa.Column('bank_tx_id', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='PENDING', nullable=False),
        sa.Column('expired_at', sa.TIMESTAMP(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('amount > 0', name='chk_topup_amount_positive'),
        sa.ForeignKeyConstraint(['user_code'], ['users.user_code'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('bank_tx_id'),
        sa.UniqueConstraint('pay_code')
        )

    if "ix_top_ups_user_code" not in _index_names("top_ups"):
        op.create_index(op.f('ix_top_ups_user_code'), 'top_ups', ['user_code'], unique=False)

    if not inspector.has_table("unmatched_tx"):
        op.create_table('unmatched_tx',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('bank_tx_id', sa.String(length=100), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('bank_account_number', sa.String(length=50), nullable=True),
        sa.Column('transfer_content', sa.Text(), nullable=False),
        sa.Column('received_at', sa.TIMESTAMP(), nullable=False),
        sa.Column('status', sa.String(length=30), server_default='UNRESOLVED', nullable=False),
        sa.Column('resolved_by', sa.String(length=50), nullable=True),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('amount > 0', name='chk_unmatched_tx_amount_positive'),
        sa.ForeignKeyConstraint(['resolved_by'], ['users.user_code'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('bank_tx_id')
        )

    if not inspector.has_table("wallet_txns"):
        op.create_table('wallet_txns',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_code', sa.String(length=50), nullable=False),
        sa.Column('txn_type', sa.String(length=30), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('balance_before', sa.Integer(), nullable=False),
        sa.Column('balance_after', sa.Integer(), nullable=False),
        sa.Column('reference_id', sa.String(length=100), nullable=True),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('balance_after >= 0', name='chk_wallet_txns_after_non_negative'),
        sa.CheckConstraint('balance_before >= 0', name='chk_wallet_txns_before_non_negative'),
        sa.ForeignKeyConstraint(['user_code'], ['users.user_code'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
        )

    if "ix_wallet_txns_user_code" not in _index_names("wallet_txns"):
        op.create_index(op.f('ix_wallet_txns_user_code'), 'wallet_txns', ['user_code'], unique=False)

    if not inspector.has_table("incidents"):
        op.create_table('incidents',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('loan_id', sa.Integer(), nullable=True),
        sa.Column('user_code', sa.String(length=50), nullable=False),
        sa.Column('incident_type', sa.String(length=50), nullable=False),
        sa.Column('severity', sa.String(length=20), server_default='NORMAL', nullable=False),
        sa.Column('penalty_amount', sa.DECIMAL(precision=10, scale=2), server_default='0.00', nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=30), server_default='PENDING', nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('penalty_amount >= 0', name='chk_incident_penalty_amount_non_negative'),
        sa.ForeignKeyConstraint(['loan_id'], ['loans.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_code'], ['users.user_code'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
        )

    if "ix_incidents_loan_id" not in _index_names("incidents"):
        op.create_index(op.f('ix_incidents_loan_id'), 'incidents', ['loan_id'], unique=False)

    if "ix_incidents_user_code" not in _index_names("incidents"):
        op.create_index(op.f('ix_incidents_user_code'), 'incidents', ['user_code'], unique=False)

    inspector = sa.inspect(op.get_bind())
    user_columns = {col["name"] for col in inspector.get_columns("users")}
    if "service_balance" not in user_columns:
        op.add_column("users", sa.Column("service_balance", sa.Integer(), server_default="0", nullable=False))
    user_constraints = {c["name"] for c in inspector.get_check_constraints("users")}
    if "chk_user_service_balance_non_negative" not in user_constraints:
        op.create_check_constraint("chk_user_service_balance_non_negative", "users", "service_balance >= 0")

    payment_columns = {col["name"] for col in inspector.get_columns("fine_payments")}
    if "payment_time" in payment_columns and "payment_date" not in payment_columns:
        # Rename retains all historical timestamps; never drop old payment values.
        op.alter_column("fine_payments", "payment_time", new_column_name="payment_date", existing_type=sa.TIMESTAMP())
    elif "payment_time" in payment_columns and "payment_date" in payment_columns:
        raise RuntimeError("Both payment_time and payment_date exist; reconcile existing values manually")
    elif "payment_date" not in payment_columns:
        raise RuntimeError("Neither payment_time nor payment_date exists in fine_payments")


def downgrade():
    # Deliberately forbid destructive rollback of restored business tables.
    raise RuntimeError("Reconciliation migration cannot be downgraded automatically; restore from verified backup")

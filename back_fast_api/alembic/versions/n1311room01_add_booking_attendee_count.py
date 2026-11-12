"""2B-22: Number of attendees used to validate room capacity.

Revision ID: n1311room01
Revises: n0611repair01
"""
from alembic import op
import sqlalchemy as sa

revision = "n1311room01"
down_revision = "n0611repair01"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table('room_bookings'):
        raise RuntimeError('room_bookings table is missing; run earlier migrations first')
    columns = {col['name'] for col in inspector.get_columns('room_bookings')}
    if 'attendee_count' not in columns:
        op.add_column('room_bookings', sa.Column('attendee_count', sa.Integer(), nullable=False, server_default='1'))
    checks = {c['name'] for c in sa.inspect(bind).get_check_constraints('room_bookings')}
    if 'chk_room_booking_attendees_positive' not in checks:
        op.create_check_constraint('chk_room_booking_attendees_positive', 'room_bookings', 'attendee_count > 0')


def downgrade():
    op.drop_constraint('chk_room_booking_attendees_positive', 'room_bookings', type_='check')
    op.drop_column('room_bookings', 'attendee_count')

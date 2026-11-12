"""Local smoke test for the 13/11 backend. Run: python scripts/verify_nhat_1311.py.
Uses in-memory SQLite; no real database or mail is touched.
"""
import io
import csv
import sys
import types
from pathlib import Path
from datetime import date, datetime, time, timedelta
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import TSVECTOR
@compiles(TSVECTOR, "sqlite")
def compile_tsvector_sqlite(type_, compiler, **kwargs):
    return "TEXT"
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models import Account, User, Room, RoomBooking, Fine, FinePayment, WalletTxn, Book, BookCopy, Loan, Incident, Category, Subject
from app.services import room_booking_service as booking
from app.services.email_notifier import context_base, render_template

root = Path(__file__).resolve().parents[1]


def must_raise(status, func, *args):
    try:
        func(*args)
    except HTTPException as error:
        assert error.status_code == status, (error.status_code, error.detail)
    else:
        raise AssertionError('Expected HTTP status ' + str(status))


def make_db(include_books=False):
    engine = create_engine('sqlite+pysqlite:///:memory:')
    models = [Account, User, Room, RoomBooking, WalletTxn, Fine, FinePayment]
    if include_books:
        models += [Category, Subject, Book, BookCopy, Loan, Incident]
    for model in models:
        model.__table__.create(engine)
    return engine, Session(engine)


def seed(db):
    db.add(Account(id=1, username='test', password='hash', role='STUDENT', is_active=True))
    db.add(User(user_code='U1', account_id=1, full_name='User Test',
                email='test@example.edu.vn', department='CNTT', user_type='STUDENT',
                total_fines=0, service_balance=80000, is_borrowing_blocked=False))
    db.add(Room(id=1, room_name='A1', capacity=20, is_active=True))
    db.commit()


def verify_bookings():
    _, db = make_db()
    seed(db)
    now = datetime(2026, 11, 13, 8, 0)
    with patch.object(booking, 'local_now', lambda: now):
        day = date(2026, 11, 13)
        reserved = booking.reserve(db, 'U1', 1, day, time(10), time(12))
        db.flush()
        must_raise(409, booking.reserve, db, 'U1', 1, day, time(11), time(13))
        must_raise(422, booking.reserve, db, 'U1', 1, day, time(12), time(13))
        must_raise(422, booking.reserve, db, 'U1', 1, day, time(14), time(16), 21)
        cancelled = booking.cancel(db, 'U1', reserved.id)
        assert cancelled.status == 'CANCELLED'
        # Slot can be reserved again after cancellation
        reserved2 = booking.reserve(db, 'U1', 1, day, time(10), time(12))
        db.flush()
    with patch.object(booking, 'local_now', lambda: datetime(2026, 11, 13, 9, 30)):
        must_raise(409, booking.cancel, db, 'U1', reserved2.id)
    with patch.object(booking, 'local_now', lambda: datetime(2026, 11, 13, 10, 10)):
        checked = booking.checkin(db, reserved2.id)
        assert checked.status == 'CHECKED_IN'
    must_raise(409, booking.checkin, db, reserved2.id)
    db.close()


def verify_import():
    # Import parser and business logic require auth dependencies provided in the normal Docker environment.
    # This stand-alone smoke test stubs only the password hasher; it never tests JWT logic.
    module = types.ModuleType('app.core.security')
    module.hash_password = lambda password: 'hashed:' + password
    with patch.dict(sys.modules, {'app.core.security': module}):
        from app.services.import_service import parse_upload, import_accounts
        sample = (root / 'users_template.csv').read_bytes()
        rows = parse_upload(sample, 'users_template.csv')
        assert len(rows) == 2
        _, db = make_db()
        results = import_accounts(db, rows)
        assert results['success_count'] == 2 and results['error_count'] == 0, results
        db.commit()
        assert db.query(User).count() == 2
        invalid = [
            (2, dict(username='sv52400222', user_code='DIFFERENT', full_name='A', email='a@b.edu', department='CNTT', role='STUDENT')),
            (3, dict(username='NEW', user_code='U999', full_name='A', email='notemail', department='CNTT', role='STUDENT')),
        ]
        results = import_accounts(db, invalid)
        assert results['success_count'] == 0 and results['error_count'] == 2, results
        db.rollback()
        db.close()


def verify_fines():
    # Stub just the debit adapter to avoid needing PostgreSQL configuration locally.
    # Uses actual SQLite row state, FinePayment and WalletTxn records.
    module = types.ModuleType('app.services.wallet_service')
    def debit(db, user_code, amount, txn_type, **kw):
        user = db.get(User, user_code)
        before = user.service_balance
        if before < amount:
            raise HTTPException(409, 'Insufficient funds')
        user.service_balance = before - amount
        txn = WalletTxn(user_code=user_code, amount=-amount, txn_type=txn_type,
                        balance_before=before, balance_after=before-amount, **kw)
        db.add(txn)
        db.flush()
        return txn
    module.debit = debit
    with patch.dict(sys.modules, {'app.services.wallet_service': module}):
        from app.services.fine_wallet_service import pay_all_fines
        _, db = make_db()
        seed(db)
        must_raise(409, pay_all_fines, db, 'U1')
        user = db.get(User, 'U1')
        user.total_fines = 100000
        db.commit()
        must_raise(402, pay_all_fines, db, 'U1')
        db.rollback()
        user = db.get(User, 'U1')
        user.total_fines = 50000
        user.is_borrowing_blocked = True
        db.commit()
        result = pay_all_fines(db, 'U1')
        db.commit()
        assert result['amount_paid'] == 50000 and result['balance_after'] == 30000
        assert db.get(User,'U1').total_fines == 0
        assert db.query(FinePayment).count() == 1
        assert db.query(WalletTxn).count() == 1
        must_raise(409, pay_all_fines, db, 'U1')
        db.close()


def verify_incident():
    from decimal import Decimal
    from app.services.incident_service import record_incident
    _, db = make_db(include_books=True)
    seed(db)
    db.add(Book(id=1, title='Book 1', author='Author', publisher='Publisher',
                publication_year=2020, price=50000, book_type='PRINTED', available_stock=0))
    db.add(BookCopy(copy_barcode='BC001', book_id=1, zone='Z1', floor='T1', shelf='S1', status='BORROWED'))
    db.flush()
    loan = Loan(user_code='U1', book_id=1, copy_barcode='BC001', loan_type='PHYSICAL',
                loan_status='BORROWED', borrow_date=datetime.now() - timedelta(days=10),
                due_date=datetime.now() + timedelta(days=1))
    db.add(loan)
    db.commit()
    result = record_incident(db, loan.id, 'BOOK_LOST', 'Lost at home')
    db.commit()
    assert Decimal(result['penalty_amount']) == Decimal('50000')
    assert db.get(Loan, loan.id).loan_status == 'LOST'
    assert db.get(BookCopy, 'BC001').status == 'RETIRED'
    assert db.get(User, 'U1').total_fines == 50000
    assert db.query(Fine).count() == 1 and db.query(Incident).count() == 1
    must_raise(409, record_incident, db, loan.id, 'BOOK_LOST', 'Repeated')
    db.rollback()
    db.close()


def verify_emails():
    context = context_base('Kiểm tra')
    contexts = {
        'room_booking.html': dict(booking_id=1, room_name='A1', booking_date='13/11/2026', slot='10:00-12:00'),
        'incident.html': dict(incident_id=1, incident_type='BOOK_LOST', amount=50000),
        'topup_confirmed.html': dict(amount=20000, balance=50000),
        'fine_paid.html': dict(amount=20000, balance=50000),
        'temporary_password.html': dict(username='test', temp_password='Temporary@123'),
    }
    for template, fields in contexts.items():
        html = render_template(template, **(context | fields))
        assert '<' in html and len(html) > 100, template


if __name__ == '__main__':
    for label, test in [('CSV import',verify_import), ('Room booking',verify_bookings),
                        ('Wallet fines',verify_fines), ('Incident atomicity',verify_incident), ('Email rendering',verify_emails)]:
        try:
            test()
            print('PASS', label)
        except Exception as e:
            print('FAIL', label, type(e).__name__, str(e))
            raise

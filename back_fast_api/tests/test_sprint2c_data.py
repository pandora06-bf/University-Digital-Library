"""Regression checks for Sprint 2C backfill and sample-data contracts."""

from datetime import datetime, timedelta

from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker

from app.models import (
    Account,
    Base,
    Book,
    BookCopy,
    Category,
    Fine,
    Incident,
    Loan,
    Room,
    RoomBooking,
    TopUp,
    User,
    WalletTxn,
    Waitlist,
)


def test_backfill_books_is_idempotent_and_preserves_zero_price(db_session):
    from scripts.backfill_new_schema import backfill_books

    category = Category(category_name="Công nghệ thông tin")
    db_session.add(category)
    db_session.flush()
    book = Book(
        title="Backfill fixture",
        author="Tester",
        publisher="TDTU",
        publication_year=2026,
        price=0,
        book_type="PRINTED",
        available_stock=0,
        category_id=category.id,
        subject_code=None,
    )
    db_session.add(book)
    db_session.flush()

    first = backfill_books(db_session)
    second = backfill_books(db_session)
    db_session.refresh(book)

    assert first["total"] == 1
    assert first["price_updated"] == 0
    assert first["subject_updated"] == 1
    assert second["price_updated"] == 0
    assert second["subject_updated"] == 0
    assert book.price == 0
    assert book.subject_code == "IT"


def test_seeder_creates_reconciled_100_book_catalog(monkeypatch, tmp_path):
    import database_seeder

    engine = create_engine(f"sqlite:///{tmp_path / 'sprint2c-seed.db'}")
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    monkeypatch.setattr(database_seeder, "SessionLocal", factory)

    try:
        database_seeder.seed_database()
        with factory() as db:
            first_counts = {
                model.__tablename__: db.query(func.count()).select_from(model).scalar()
                for model in (
                    Account, User, Book, Room, Loan, Waitlist, Fine, Incident,
                    RoomBooking, TopUp, WalletTxn,
                )
            }
            assert first_counts["books"] == 100
            assert first_counts["users"] == 101
            assert first_counts["rooms"] == 4
            assert {
                "CONFIRMED", "CHECKED_IN", "CANCELLED", "NO_SHOW"
            }.issubset({row[0] for row in db.query(RoomBooking.status).distinct()})
            assert {"PAID", "PENDING", "EXPIRED"}.issubset(
                {row[0] for row in db.query(TopUp.status).distinct()}
            )
            assert {"TOPUP", "BOOKING_PAYMENT", "REFUND", "FINE_PAYMENT"}.issubset(
                {row[0] for row in db.query(WalletTxn.txn_type).distinct()}
            )
            assert db.query(Fine).count() >= 2
            assert db.query(Incident).filter(Incident.description.like("Báo mất %")).count() >= 1

            # Dữ liệu mẫu không còn chữ DEMO và đặt tên giống database chính (MSSV, GV0NNN, BC-NNN-CC)
            assert db.query(Book).filter(Book.title.ilike("%demo%")).count() == 0
            assert db.query(Book).filter(Book.keywords.ilike("%demo%")).count() == 0
            assert db.query(User).filter(User.user_code.ilike("%demo%") | User.email.ilike("%demo%")).count() == 0
            assert db.query(Account).filter(Account.username.ilike("%demo%")).count() == 0
            assert {"52400011", "gv0004"} <= {row[0] for row in db.query(Account.username)}
            assert db.query(User).filter_by(user_code="52400011", email="52400011@library.local").count() == 1
            assert db.query(BookCopy).filter(BookCopy.copy_barcode.ilike("%demo%")).count() == 0
            assert db.query(BookCopy).filter_by(copy_barcode="BC-001-01").count() == 1
            for table, column in ((Loan, Loan.checkout_condition), (RoomBooking, RoomBooking.notes),
                                  (TopUp, TopUp.pay_code), (WalletTxn, WalletTxn.reference_id)):
                assert db.query(table).filter(column.ilike("%demo%")).count() == 0

            checked = db.query(RoomBooking).filter_by(notes="RB-002").one()
            local_checkin = checked.checkin_time + timedelta(hours=7)
            assert checked.booking_date == local_checkin.date()
            assert checked.slot_start <= local_checkin.time() < checked.slot_end
            assert checked.checkin_time <= datetime.utcnow() + timedelta(seconds=2)

            # Wallet ledger closes at the balance shown in each sample profile.
            sample_users = db.query(User).filter(User.user_type != "ADMIN").all()
            for user in sample_users:
                entries = (
                    db.query(WalletTxn)
                    .filter_by(user_code=user.user_code)
                    .order_by(WalletTxn.created_at, WalletTxn.id)
                    .all()
                )
                if entries:
                    assert entries[0].balance_before == 0
                    for previous, current in zip(entries, entries[1:]):
                        assert current.balance_before == previous.balance_after
                    assert entries[-1].balance_after == user.service_balance

        # Running a second time must reconcile the same stable fixtures, not duplicate them.
        database_seeder.seed_database()
        with factory() as db:
            second_counts = {
                model.__tablename__: db.query(func.count()).select_from(model).scalar()
                for model in (
                    Account, User, Book, Room, Loan, Waitlist, Fine, Incident,
                    RoomBooking, TopUp, WalletTxn,
                )
            }
        assert second_counts == first_counts
    finally:
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_csv_import_fixtures_match_the_expected_contract():
    from validate_csv_fixtures import validate

    validate()

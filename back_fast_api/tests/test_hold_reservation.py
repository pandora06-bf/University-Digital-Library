"""Bản đang giữ cho người xếp hàng (Waitlist HELD) không được người khác đặt chồng lên."""
from datetime import datetime, timedelta

from app.models import Waitlist
from tests.test_physical_loan import _make_book, _make_reader


def _hold(db, user, book, hours=20):
    entry = Waitlist(user_code=user.user_code, book_id=book.id, queue_position=1,
                     status="HELD", hold_expires_at=datetime.utcnow() + timedelta(hours=hours))
    db.add(entry)
    db.commit()
    return entry


def test_other_reader_cannot_request_held_copy(client, db_session):
    holder, _ = _make_reader(db_session, user_code="HR0001")
    _, headers = _make_reader(db_session, user_code="HR0002")
    book = _make_book(db_session, available_stock=1)
    _hold(db_session, holder, book)

    response = client.post("/api/loans/physical/request", json={"book_id": book.id}, headers=headers)

    assert response.status_code == 409
    assert "đang được giữ" in response.json()["detail"]


def test_holder_can_request_and_leaves_queue(client, db_session):
    holder, headers = _make_reader(db_session, user_code="HR0003")
    book = _make_book(db_session, available_stock=1)
    _hold(db_session, holder, book)

    response = client.post("/api/loans/physical/request", json={"book_id": book.id}, headers=headers)

    assert response.status_code == 201
    assert db_session.query(Waitlist).filter_by(book_id=book.id).count() == 0


def test_expired_hold_does_not_block(client, db_session):
    holder, _ = _make_reader(db_session, user_code="HR0004")
    _, headers = _make_reader(db_session, user_code="HR0005")
    book = _make_book(db_session, available_stock=1)
    _hold(db_session, holder, book, hours=-1)

    response = client.post("/api/loans/physical/request", json={"book_id": book.id}, headers=headers)

    assert response.status_code == 201


def test_can_join_waitlist_when_every_copy_is_held(client, db_session):
    holder, _ = _make_reader(db_session, user_code="HR0006")
    _, headers = _make_reader(db_session, user_code="HR0007")
    book = _make_book(db_session, available_stock=1)
    _hold(db_session, holder, book)

    response = client.post("/api/waitlists", json={"book_id": book.id}, headers=headers)

    assert response.status_code == 201
    assert response.json()["queue_position"] == 2

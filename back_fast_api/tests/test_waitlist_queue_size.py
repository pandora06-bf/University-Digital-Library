"""3-13: API đặt trước trả queue_size để giao diện hiện "vị trí x/y"."""
from app.models.book import Book
from app.models.loan import Waitlist
from app.models.user import Account, User


def _reader(db_session, code):
    account = Account(username=f"wl_{code}", password="unused", role="STUDENT", is_active=True)
    db_session.add(account)
    db_session.flush()
    db_session.add(User(user_code=code, account_id=account.id, full_name=code, email=f"{code}@library.local",
                        department="Library", user_type="STUDENT", is_borrowing_blocked=False,
                        total_fines=0, max_borrow_limit=3, max_borrow_days=14))
    db_session.flush()


def _book(db_session, title):
    book = Book(title=title, author="Author", publisher="Publisher", publication_year=2026,
                book_type="PRINTED", available_stock=0)
    db_session.add(book)
    db_session.flush()
    return book


def test_join_and_list_return_queue_size(client, db_session, test_account, auth_headers):
    busy, quiet = _book(db_session, "Queue size busy"), _book(db_session, "Queue size quiet")
    for code in ("WL-A", "WL-B", "WL-OLD"):
        _reader(db_session, code)
    db_session.add_all([
        Waitlist(user_code="WL-A", book_id=busy.id, queue_position=1, status="HELD"),
        Waitlist(user_code="WL-B", book_id=busy.id, queue_position=2, status="WAITING"),
        # Mục đã hết hiệu lực không được tính vào hàng chờ.
        Waitlist(user_code="WL-OLD", book_id=busy.id, queue_position=9, status="EXPIRED"),
    ])
    db_session.commit()

    joined = client.post("/api/waitlists", json={"book_id": busy.id}, headers=auth_headers)
    assert joined.status_code == 201, joined.text
    assert joined.json()["queue_position"] == 3
    assert joined.json()["queue_size"] == 3

    alone = client.post("/api/waitlists", json={"book_id": quiet.id}, headers=auth_headers)
    assert alone.status_code == 201, alone.text
    assert (alone.json()["queue_position"], alone.json()["queue_size"]) == (1, 1)

    mine = client.get("/api/waitlists/my-waitlists", headers=auth_headers)
    assert mine.status_code == 200
    by_book = {row["book_id"]: (row["queue_position"], row["queue_size"]) for row in mine.json()["data"]}
    assert by_book == {busy.id: (3, 3), quiet.id: (1, 1)}


def test_my_waitlists_empty_still_ok(client, auth_headers):
    response = client.get("/api/waitlists/my-waitlists", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == {"data": [], "total": 0}

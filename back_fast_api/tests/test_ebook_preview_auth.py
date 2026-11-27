"""SRS UC04 + danh mục API: GET /api/ebooks/{id}/preview chỉ dành cho người đã đăng nhập (Khách không đọc eBook)."""
from app.models.book import Book, Ebook


def _ebook(db_session):
    book = Book(title="Preview auth", author="T", publisher="QA", publication_year=2026, book_type="EBOOK", available_stock=0)
    db_session.add(book)
    db_session.flush()
    db_session.add(Ebook(id=book.id, file_path="private:ebooks/ebook-001.pdf", is_free=False, preview_pages=2, borrow_days=14))
    db_session.commit()
    return book


def test_guest_cannot_preview_ebook(client, db_session):
    book = _ebook(db_session)
    res = client.get(f"/api/ebooks/{book.id}/preview")
    assert res.status_code == 401


def test_logged_in_reader_can_preview_ebook(client, db_session, auth_headers):
    book = _ebook(db_session)
    res = client.get(f"/api/ebooks/{book.id}/preview", headers=auth_headers)
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF-")

"""SRS UC02/UC03: GET /api/books có lọc + phân trang; chi tiết sách đủ trường; thuộc tính sách."""
import pytest

from app.models.book import Book, Subject
from app.models.book_attributes import BOOK_ATTRIBUTES, infer_book_attribute


def _book(db, title, attribute, subject="SRSX", **extra):
    if not db.get(Subject, subject):
        db.add(Subject(subject_code=subject, subject_name="Môn SRS", department_name="Khoa SRS"))
        db.flush()
    book = Book(title=title, author="Robert Martin", publisher="Pearson", publication_year=2008, book_type="PRINTED",
                available_stock=1, subject_code=subject, book_attribute=attribute, **extra)
    db.add(book)
    db.commit()
    db.refresh(book)
    return book


@pytest.mark.parametrize("title,expected", [
    ("English Grammar in Use", "WORKBOOK"),
    ("Introduction to Algorithms", "TEXTBOOK"),
    ("Computer Networks (4th Edition)", "TEXTBOOK"),
    ("Clean Code: A Handbook of Agile Software Craftsmanship", "REFERENCE"),
])
def test_infer_book_attribute(title, expected):
    assert infer_book_attribute(title) == expected


def test_get_books_filters_by_attribute_subject_and_returns_fields(client, db_session):
    _book(db_session, "SRS giao trinh", "TEXTBOOK")
    _book(db_session, "SRS bai tap", "WORKBOOK")
    res = client.get("/api/books", params={"subject_code": "SRSX", "attribute": "WORKBOOK", "limit": 10})
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    item = body["items"][0]
    assert (item["title"], item["book_attribute"], item["subject_code"]) == ("SRS bai tap", "WORKBOOK", "SRSX")


def test_get_books_author_publisher_year_and_page_limit(client, db_session):
    _book(db_session, "SRS loc", "REFERENCE")
    res = client.get("/api/books", params={"subject_code": "SRSX", "author": "martin", "publisher": "pearson", "year": 2008})
    assert res.status_code == 200 and res.json()["total"] == 1
    assert client.get("/api/books", params={"limit": 51}).status_code == 422
    assert client.get("/api/books", params={"page_size": 51}).status_code == 422


def test_book_detail_has_srs_fields(client, db_session):
    book = _book(db_session, "SRS chi tiet", "TEXTBOOK", alternative_title="Tên khác", num_chapters=12,
                 num_pages=300, keywords="srs mau")
    data = client.get(f"/api/books/{book.id}").json()
    assert data["alternative_title"] == "Tên khác"
    assert data["book_attribute"] == "TEXTBOOK" and data["book_attribute_label"] == "Giáo trình"
    assert (data["num_chapters"], data["num_pages"], data["keywords"]) == (12, 300, "srs mau")


def test_categories_list_attributes(client, db_session):
    _book(db_session, "SRS dem", "WORKBOOK")
    attrs = {a["code"]: a for a in client.get("/api/books/categories").json()["attributes"]}
    assert set(attrs) == set(BOOK_ATTRIBUTES)
    assert attrs["WORKBOOK"]["label"] == "Sách bài tập" and attrs["WORKBOOK"]["count"] >= 1


def test_admin_can_save_attribute_and_rejects_unknown(client, admin_headers):
    base = {"title": "SRS admin", "author": "A", "publisher": "B", "publication_year": 2026, "book_type": "PRINTED"}
    ok = client.post("/api/admin/books", json={**base, "book_attribute": "WORKBOOK", "alternative_title": "Khác",
                                               "num_chapters": 5}, headers=admin_headers)
    assert ok.status_code in (200, 201), ok.text
    assert ok.json()["book_attribute"] == "WORKBOOK"
    bad = client.post("/api/admin/books", json={**base, "title": "SRS sai", "book_attribute": "NOVEL"}, headers=admin_headers)
    assert bad.status_code == 422

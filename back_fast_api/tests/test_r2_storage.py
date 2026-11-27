"""Lưu PDF eBook trên Cloudflare R2 (STORAGE_BACKEND=r2) — dùng R2 giả trong bộ nhớ, không cần mạng."""
import asyncio
from io import BytesIO

import pytest
from fastapi import HTTPException, UploadFile
from pypdf import PdfReader, PdfWriter
from starlette.datastructures import Headers

from app.core.security import hash_password
from app.models.book import Book, Ebook
from app.models.user import Account, User
from app.services import ebook_service, object_storage, upload_service
from scripts import migrate_ebooks_to_r2 as migration


class _NotFound(Exception):
    response = {"Error": {"Code": "NoSuchKey"}}


class FakeR2:
    def __init__(self):
        self.objects = {}

    def put_object(self, Bucket, Key, Body, ContentType):
        self.objects[(Bucket, Key)] = bytes(Body)

    def get_object(self, Bucket, Key):
        if (Bucket, Key) not in self.objects:
            raise _NotFound()
        return {"Body": BytesIO(self.objects[(Bucket, Key)])}

    def head_object(self, Bucket, Key):
        if (Bucket, Key) not in self.objects:
            raise _NotFound()
        return {"ContentLength": len(self.objects[(Bucket, Key)])}

    def delete_object(self, Bucket, Key):
        self.objects.pop((Bucket, Key), None)


@pytest.fixture
def r2(monkeypatch):
    fake = FakeR2()
    monkeypatch.setenv("STORAGE_BACKEND", "r2")
    monkeypatch.setenv("R2_BUCKET", "test-bucket")
    monkeypatch.setattr(object_storage, "_client", lambda: fake)
    return fake


def _pdf(pages=3):
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=100, height=100)
    out = BytesIO()
    writer.write(out)
    return out.getvalue()


def _upload(data, name="sach.pdf"):
    return UploadFile(filename=name, file=BytesIO(data), headers=Headers({"content-type": "application/pdf"}))


def test_upload_goes_to_r2_and_reads_back(r2):
    data = _pdf()
    path = asyncio.run(upload_service.save_ebook_pdf(_upload(data)))
    assert path.startswith("r2:ebooks/") and path.endswith(".pdf")
    key = ("test-bucket", "ebooks/" + path.removeprefix("r2:ebooks/"))
    assert r2.objects[key] == data
    assert upload_service.read_private_pdf(path) == data
    upload_service.delete_static_file(path)
    assert key not in r2.objects


def test_local_backend_is_still_the_default(monkeypatch):
    monkeypatch.delenv("STORAGE_BACKEND", raising=False)
    data = _pdf(1)
    path = asyncio.run(upload_service.save_ebook_pdf(_upload(data)))
    assert path.startswith("private:ebooks/")
    assert upload_service.read_private_pdf(path) == data
    upload_service.resolve_private_pdf(path).unlink()


@pytest.mark.parametrize("bad", ["r2:ebooks/../secret.pdf", "r2:ebooks/sub/x.pdf", "r2:ebooks/x.txt", "r2:other/x.pdf"])
def test_r2_paths_cannot_escape_the_ebooks_folder(r2, bad):
    with pytest.raises(HTTPException) as e:
        upload_service.read_private_pdf(bad)
    assert e.value.status_code == 404


def test_missing_object_is_404(r2):
    with pytest.raises(HTTPException) as e:
        upload_service.read_private_pdf("r2:ebooks/khong-co.pdf")
    assert e.value.status_code == 404


def _reader_and_book(db_session, file_path, is_free=False):
    account = Account(username="r2_reader", password=hash_password("Password123@"), role="STUDENT", is_active=True)
    db_session.add(account)
    db_session.flush()
    user = User(account_id=account.id, user_code="R2-0001", full_name="R2 Tester", email="r2@library.local",
                department="CNTT", user_type="STUDENT", max_borrow_limit=3, max_borrow_days=14,
                is_borrowing_blocked=False, total_fines=0)
    book = Book(title="R2 Ebook", author="Tester", publisher="QA", publication_year=2026,
                book_type="EBOOK", available_stock=0)
    db_session.add_all([user, book])
    db_session.flush()
    db_session.add(Ebook(id=book.id, file_path=file_path, is_free=is_free, preview_pages=2, borrow_days=14))
    db_session.commit()
    db_session.refresh(book)
    return user, book


def test_preview_and_stream_read_from_r2(r2, db_session):
    data = _pdf(5)
    path = object_storage.put_pdf("r2-test.pdf", data)
    user, book = _reader_and_book(db_session, path)
    assert len(PdfReader(BytesIO(ebook_service.pdf_preview(book))).pages) == 2  # chỉ trang xem trước
    loan = ebook_service.borrow(db_session, user.user_code, book.id)
    token = ebook_service.make_read_token(loan, user.user_code)
    assert ebook_service.authorized_pdf(db_session, user.user_code, book.id, token) == data
    with pytest.raises(HTTPException) as e:
        ebook_service.authorized_pdf(db_session, user.user_code, book.id, "sai-token")
    assert e.value.status_code == 403


class _KeepOpen:
    """Bọc db_session của test để script gọi close() mà không đóng phiên thật."""
    def __init__(self, session):
        self.session = session

    def __getattr__(self, name):
        return getattr(self.session, name)

    def close(self):
        pass


def test_migration_uploads_once_and_can_revert(r2, db_session):
    _, book = _reader_and_book(db_session, "private:ebooks/ebook-001.pdf")
    factory = lambda: _KeepOpen(db_session)  # noqa: E731
    quiet = lambda *_: None  # noqa: E731

    dry = migration.migrate(dry_run=True, session_factory=factory, out=quiet)
    assert dry["updated_rows"] >= 1 and r2.objects == {}

    first = migration.migrate(session_factory=factory, out=quiet)
    assert first["uploaded"] >= 1
    db_session.refresh(book.ebook)
    assert book.ebook.file_path == "r2:ebooks/ebook-001.pdf"
    local = upload_service.EBOOKS_DIR / "ebook-001.pdf"
    assert r2.objects[("test-bucket", "ebooks/ebook-001.pdf")] == local.read_bytes()

    again = migration.migrate(session_factory=factory, out=quiet)
    assert again["uploaded"] == 0 and again["already_r2"] >= 1

    back = migration.revert(session_factory=factory, out=quiet)
    assert back["reverted"] >= 1
    db_session.refresh(book.ebook)
    assert book.ebook.file_path == "private:ebooks/ebook-001.pdf"

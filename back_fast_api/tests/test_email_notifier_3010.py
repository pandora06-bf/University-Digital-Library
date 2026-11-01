from datetime import datetime
from unittest.mock import AsyncMock, patch
from app.services import email_notifier as email


def test_template_all_three_transactional_events(monkeypatch):
    monkeypatch.setenv("LIBRARY_URL", "https://library.example.edu.vn")
    base = email.context_base("Nguyễn Văn A")
    receipt = email.render_template("receipt.html", **base, receipt_id="BL-1", borrow_date="28/10/2026", due_date="11/11/2026", books=[{"title":"Sách", "author":"Tác giả", "loan_code":"PM-1"}])
    due = email.render_template("due_reminder.html", **base, book_title="Sách", loan_code="PM-1", due_date="11/11/2026")
    hold = email.render_template("hold_24h.html", **base, book_title="Sách", hold_code="GC-1", pickup_deadline="29/10/2026", pickup_location="Quầy mượn")
    assert "PM-1" in receipt and "Sách" in due and "GC-1" in hold


def test_local_date_uses_vietnam_timezone():
    assert email.local_date(datetime(2026, 10, 28, 0, 0)) == "28/10/2026, 07:00"


def test_site_url_rejects_insecure_public_domain(monkeypatch):
    monkeypatch.setenv("LIBRARY_URL", "http://public.example.com")
    import pytest
    with pytest.raises(ValueError):
        email.site_url("my-books")

import asyncio
import sys
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from app.services import email_notifier as email


def test_send_html_reads_smtp_settings_from_dotenv(monkeypatch, tmp_path):
    (tmp_path / ".env").write_text(
        "SMTP_HOST=smtp.example.test\nSMTP_FROM=library@example.test\n",
        encoding="utf-8",
    )
    monkeypatch.chdir(tmp_path)
    for key in ("SMTP_HOST", "SMTP_FROM", "SMTP_USER", "SMTP_PASSWORD"):
        monkeypatch.setenv(key, "")

    connection_config = MagicMock()
    fast_mail = MagicMock()
    fast_mail.return_value.send_message = AsyncMock()
    monkeypatch.setitem(
        sys.modules,
        "fastapi_mail",
        SimpleNamespace(
            ConnectionConfig=connection_config,
            FastMail=fast_mail,
            MessageSchema=MagicMock(),
            MessageType=SimpleNamespace(html="html"),
        ),
    )
    with patch("app.services.email_notifier.render_template", return_value="<p>Reminder</p>"):
        sent = asyncio.run(
            email.send_html(
                "reader@example.edu.vn",
                "Reminder",
                "due_reminder.html",
                {"book_title": "Sách", "loan_code": "PM-1", "due_date": "11/11/2026"},
            )
        )

    assert sent is True
    assert connection_config.call_args.kwargs["MAIL_SERVER"] == "smtp.example.test"
    assert connection_config.call_args.kwargs["MAIL_FROM"] == "library@example.test"


def test_template_all_three_transactional_events(monkeypatch):
    monkeypatch.setenv("LIBRARY_URL", "https://library.example.edu.vn")
    base = email.context_base("Nguyễn Văn A")
    receipt = email.render_template("receipt.html", **base, receipt_id="BL-1", borrow_date="28/10/2026", due_date="11/11/2026", books=[{"title":"Sách", "author":"Tác giả", "loan_code":"PM-1"}])
    due = email.render_template("due_reminder.html", **base, book_title="Sách", loan_code="PM-1", due_date="11/11/2026")
    hold = email.render_template("hold_notice.html", **base, book_title="Sách", hold_code="GC-1", pickup_deadline="29/10/2026", pickup_location="Quầy mượn")
    assert "PM-1" in receipt and "Sách" in due and "GC-1" in hold


def test_local_date_uses_vietnam_timezone():
    assert email.local_date(datetime(2026, 10, 28, 0, 0)) == "28/10/2026, 07:00"


def test_topup_confirmation_uses_top_up_template_and_records_success(monkeypatch):
    from app.models.notification import EmailNotice

    sent_message = {}
    monkeypatch.setattr(
        email,
        "send_sync",
        lambda recipient, subject, template, context: (
            sent_message.update(
                recipient=recipient,
                subject=subject,
                template=template,
                context=context,
            )
            or True
        ),
    )

    class FakeSession:
        notice = None
        committed = False

        def add(self, notice):
            self.notice = notice

        def commit(self):
            self.committed = True

        def rollback(self):
            raise AssertionError("Unexpected database rollback")

        def close(self):
            pass

    db = FakeSession()
    monkeypatch.setattr("app.core.database.SessionLocal", lambda: db)

    sent = email.send_topup_confirmed(
        "reader@example.test",
        "Reader",
        "BANK-123",
        "TVABCDEFGH",
        70_000,
        datetime(2026, 11, 23, 13, 15),
        120_000,
    )

    assert sent is True
    assert sent_message["template"] == "top_up.html"
    assert sent_message["context"]["transaction_id"] == "BANK-123"
    assert sent_message["context"]["pay_code"] == "TVABCDEFGH"
    assert sent_message["context"]["amount"] == "70.000 VNĐ"
    assert sent_message["context"]["paid_at"] == "23/11/2026, 20:15"
    assert sent_message["context"]["balance_after"] == "120.000 VNĐ"
    assert isinstance(db.notice, EmailNotice)
    assert db.notice.event_key == "topup:BANK-123"
    assert db.notice.recipient == "reader@example.test"
    assert db.committed is True


def test_checkout_receipt_keeps_utc_timestamp_and_records_success(monkeypatch):
    from app.models.notification import EmailNotice
    from app.services import loan_service

    borrow_date = datetime(2026, 11, 23, 12, 30)
    due_date = datetime(2026, 12, 7, 12, 30)
    send_receipt = MagicMock(return_value=True)
    monkeypatch.setattr(email, "send_receipt", send_receipt)

    class FakeSession:
        notice = None
        committed = False

        def add(self, notice):
            self.notice = notice

        def commit(self):
            self.committed = True

        def rollback(self):
            raise AssertionError("Unexpected database rollback")

        def close(self):
            pass

    db = FakeSession()
    monkeypatch.setattr(loan_service, "SessionLocal", lambda: db)

    loan_service.send_checkout_receipt_email(
        "reader@example.test",
        123,
        "Test book",
        due_date,
        borrow_date=borrow_date,
    )

    assert send_receipt.call_args.args[5] == borrow_date
    assert send_receipt.call_args.args[6] == due_date
    assert isinstance(db.notice, EmailNotice)
    assert db.notice.event_key == "receipt:123"
    assert db.notice.recipient == "reader@example.test"
    assert db.committed is True


def test_site_url_rejects_insecure_public_domain(monkeypatch):
    monkeypatch.setenv("LIBRARY_URL", "http://public.example.com")
    import pytest
    with pytest.raises(ValueError):
        email.site_url("my-books")


def test_reserved_domain_is_skipped_without_smtp(monkeypatch):
    """@library.local (tài khoản mẫu) không gửi được: bỏ qua êm, không gọi SMTP, không ném lỗi."""
    monkeypatch.setenv("SMTP_HOST", "smtp.example.test")
    monkeypatch.setenv("SMTP_FROM", "library@example.test")
    with patch("fastapi_mail.FastMail") as fast_mail:
        assert asyncio.run(email.send_html("sv52400011@library.local", "S", "due_reminder.html", {})) is False
        fast_mail.assert_not_called()
    assert email.is_deliverable("reader@example.edu.vn") is True

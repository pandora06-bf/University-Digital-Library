from datetime import datetime
from unittest.mock import patch
from app.services.reminder_email import send_due_email


def test_due_email_subject_and_timezone(monkeypatch):
    monkeypatch.setenv('SMTP_HOST', 'smtp.example.test')
    monkeypatch.setenv('SMTP_FROM', 'library@example.test')
    monkeypatch.setenv('SMTP_PORT', '587')
    with patch('app.services.reminder_email.smtplib.SMTP') as smtp:
        send_due_email('student@example.test', 'Student', 'Algorithms', datetime(2026, 10, 16, 0, 0))
        sent = smtp.return_value.__enter__.return_value.send_message.call_args.args[0]
        assert sent['To'] == 'student@example.test'
        assert 'Nhắc hạn' in str(sent['Subject'])
        assert '07:00' in sent.get_content()


def test_unconfigured_smtp_rejected(monkeypatch):
    monkeypatch.delenv('SMTP_HOST', raising=False)
    monkeypatch.delenv('SMTP_FROM', raising=False)
    import pytest
    with pytest.raises(RuntimeError, match='SMTP_HOST'):
        send_due_email('student@example.test', 'Student', 'Algorithms', datetime(2026, 10, 16))

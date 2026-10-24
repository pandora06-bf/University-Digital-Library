import calendar
from datetime import datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

from app.scheduler_worker import RATE, configure_scheduler
from app.services.ebook_service import make_read_token, utcnow
from app.core.security import decode_access_token

def test_rate():
    assert RATE * 3 == Decimal("15000")

def test_read_token_expiry_matches_due_date():
    due = utcnow() + timedelta(days=2)
    loan = SimpleNamespace(id=5, book_id=7, due_date=due)
    payload = decode_access_token(make_read_token(loan, "TEST001"))
    assert payload["sub"] == "TEST001"
    assert payload["loan_id"] == 5
    # due is naive-but-UTC (see ebook_service.utcnow); calendar.timegm treats it
    # as UTC regardless of the host machine's local timezone, unlike .timestamp().
    assert abs(payload["exp"] - calendar.timegm(due.timetuple())) <= 1

def test_scheduler_has_core_jobs():
    scheduler = configure_scheduler()
    assert {"JOB-01", "JOB-03", "JOB-05"}.issubset({job.id for job in scheduler.get_jobs()})
    assert str(scheduler.timezone) == "Asia/Ho_Chi_Minh"

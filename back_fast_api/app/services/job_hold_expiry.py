"""JOB-04 hook. Register this with the single APScheduler worker, not each API process."""
import logging
from app.core.database import SessionLocal
from app.services.waitlist_logic import expire_holds
from app.services.email_notifier import send_hold
from app.models.user import User
from app.models.book import Book

logger = logging.getLogger(__name__)

def job_hold_expiry():
    with SessionLocal() as db:
        result = expire_holds(db)
        logger.info("JOB-04 hold expiry: %s", result)
        for hold_id, user_code, book_id, expiry in result.get("promoted", []):
            user = db.get(User, user_code)
            book = db.get(Book, book_id)
            if user and user.email and book:
                send_hold(user.email, user.full_name, book.title, hold_id, expiry)
        return result

"""JOB-04 hook. Register this with the single APScheduler worker, not each API process."""
import logging
from app.core.database import SessionLocal
from app.services.waitlist_logic import expire_holds

logger = logging.getLogger(__name__)

def job_hold_expiry():
    with SessionLocal() as db:
        result = expire_holds(db)
        logger.info("JOB-04 hold expiry: %s", result)
        return result

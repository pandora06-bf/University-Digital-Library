from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.services.fine_wallet_service import pay_all_fines
from app.services.email_notifier import send_fine_paid
router = APIRouter(prefix='/api/fines', tags=['Fines'])

@router.post('/pay-by-wallet')
def pay(tasks: BackgroundTasks, user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        result = pay_all_fines(db, user.user_code)
        db.commit()
        tasks.add_task(send_fine_paid, user.email, user.full_name, result["amount_paid"], result["balance_after"])
        return result
    except Exception:
        db.rollback()
        raise

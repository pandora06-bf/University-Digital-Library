from decimal import Decimal
from fastapi import APIRouter, Depends, BackgroundTasks, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.user import User
from app.services.incident_service import record_incident, list_incidents
from app.services.email_notifier import send_incident_notice
router = APIRouter(prefix='/api/admin', tags=['Admin - Incidents'])

class IncidentBody(BaseModel):
    loan_id: int
    incident_type: str
    description: str = Field(min_length=1)
    manual_penalty: Decimal | None = None
    manual_reason: str | None = None

@router.post('/loans/incident', status_code=201)
def create_incident(body: IncidentBody, tasks: BackgroundTasks, _=Depends(require_roles('ADMIN', 'LIBRARIAN')),
                    db: Session = Depends(get_db)):
    try:
        result = record_incident(db, body.loan_id, body.incident_type, body.description,
                                 body.manual_penalty, body.manual_reason)
        from app.models.loan import Incident
        item = db.get(Incident, result['incident_id'])
        user = db.get(User, item.user_code)
        email = user.email if user else None
        name = user.full_name if user else ''
        db.commit()
        if email:
            tasks.add_task(send_incident_notice, email, name, result['incident_id'],
                           result['type'], result['penalty_amount'])
        return result
    except Exception:
        db.rollback()
        raise

@router.get('/incidents')
def get_incidents(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
                  _=Depends(require_roles('ADMIN', 'LIBRARIAN')), db: Session = Depends(get_db)):
    return list_incidents(db, page, size)

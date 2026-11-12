"""4-01.b: Hoàn tất báo mất/hỏng từ phiếu đang mượn, toàn bộ transaction do caller commit."""
from datetime import datetime
from zoneinfo import ZoneInfo
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.loan import Loan, Incident
from app.models.user import User
from app.models.fine import Fine
from app.models.book import Book, BookCopy

RATE = Decimal('5000')

def record_incident(db: Session, loan_id: int, incident_type: str, description: str,
                    manual_penalty=None, manual_reason=None):
    incident_type = incident_type.upper().strip()
    if incident_type not in ('BOOK_LOST', 'BOOK_DAMAGED'):
        raise HTTPException(422, 'Loại sự cố không hợp lệ')
    loan = db.scalar(select(Loan).where(Loan.id == loan_id).with_for_update())
    if loan is None:
        raise HTTPException(404, 'Không tìm thấy phiếu mượn')
    if loan.loan_status not in ('BORROWED', 'OVERDUE') or loan.return_date is not None:
        raise HTTPException(409, 'Phiếu mượn không ở trạng thái đang mượn')
    if db.scalar(select(Incident.id).where(Incident.loan_id == loan.id)):
        raise HTTPException(409, 'Phiếu mượn đã có biên bản sự cố')
    user = db.scalar(select(User).where(User.user_code == loan.user_code).with_for_update())
    book = db.get(Book, loan.book_id)
    if not loan.copy_barcode:
        raise HTTPException(409, 'Phiếu không gắn với bản sao sách giấy để báo mất/hỏng')
    copy = db.scalar(select(BookCopy).where(BookCopy.copy_barcode == loan.copy_barcode).with_for_update()) if loan.copy_barcode else None
    if copy is None:
        raise HTTPException(409, 'Không tìm thấy bản sao sách của phiếu mượn')
    price = Decimal(book.price or 0) if book else Decimal(0)
    if price <= 0:
        if manual_penalty is None or Decimal(str(manual_penalty)) <= 0 or not (manual_reason or '').strip():
            raise HTTPException(422, 'Sách thiếu giá bìa: phải nhập số tiền bồi thường và lý do')
        price = Decimal(str(manual_penalty))
    now = datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).replace(tzinfo=None)
    days = max((now.date() - loan.due_date.date()).days, 0)
    fine = db.scalar(select(Fine).where(Fine.loan_id == loan.id).with_for_update())
    # Không nhân đôi khoản quá hạn đã ghi nhận, chỉ tính phần chưa phản ánh trong fine.
    overdue = Decimal(days) * RATE
    previous = Decimal(fine.total_amount) if fine and fine.payment_status == 'UNPAID' else Decimal(0)
    if fine and fine.payment_status == 'PAID':
        raise HTTPException(409, 'Khoản phạt của phiếu này đã thanh toán; cần đối soát trước khi lập sự cố')
    else:
        overdue_due = max(Decimal(0), overdue - previous)
    penalty = price + overdue_due
    if fine and fine.payment_status == 'UNPAID':
        fine.total_amount += penalty
        fine.overdue_days = max(fine.overdue_days, days)
    elif fine is None:
        db.add(Fine(loan_id=loan.id, user_code=user.user_code, overdue_days=days,
                    fine_rate=RATE, total_amount=penalty, payment_status='UNPAID', created_at=now))
    incident = Incident(loan_id=loan.id, user_code=user.user_code, incident_type=incident_type,
        severity='SEVERE', penalty_amount=penalty, description=description,
        status='RESOLVED', created_at=now)
    db.add(incident)
    loan.loan_status = 'LOST' if incident_type == 'BOOK_LOST' else 'RETURNED'
    loan.return_date = now
    loan.checkin_condition = description
    if copy:
        copy.status = 'RETIRED'
        copy.damage_notes = description
    user.total_fines = Decimal(user.total_fines or 0) + penalty
    user.is_borrowing_blocked = True
    db.flush()
    return {'incident_id': incident.id, 'loan_id': loan.id, 'type': incident_type,
            'penalty_amount': str(penalty), 'overdue_days': days, 'loan_status': loan.loan_status}

def list_incidents(db: Session, page: int, size: int):
    rows = db.scalars(select(Incident).order_by(Incident.id.desc()).offset((page-1)*size).limit(size)).all()
    return {'data': [{'id': x.id, 'loan_id': x.loan_id, 'user_code': x.user_code,
              'incident_type': x.incident_type, 'penalty_amount': str(x.penalty_amount),
              'description': x.description, 'status': x.status, 'created_at': x.created_at}
              for x in rows], 'page': page, 'size': size}

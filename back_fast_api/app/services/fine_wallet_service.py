"""4-02: trả toàn bộ nợ phạt bằng ví trong một giao dịch nguyên tử."""
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.fine import Fine, FinePayment
from app.services.wallet_service import debit

def pay_all_fines(db: Session, user_code: str):
    user = db.scalar(select(User).where(User.user_code == user_code).with_for_update())
    if user is None:
        raise HTTPException(404, 'Không tìm thấy người dùng')
    total = Decimal(user.total_fines or 0)
    if total <= 0:
        raise HTTPException(409, 'Không còn khoản phạt chưa thanh toán')
    if total != total.to_integral_value():
        raise HTTPException(409, 'Số tiền phạt phải quy đổi về đơn vị VND nguyên')
    amount = int(total)
    if int(user.service_balance or 0) < amount:
        raise HTTPException(402, {'message': 'Số dư không đủ', 'required': amount,
                                  'balance': int(user.service_balance or 0),
                                  'missing': amount - int(user.service_balance or 0)})
    txn = debit(db, user_code, amount, 'FINE_PAYMENT', description='Thanh toán toàn bộ tiền phạt')
    payment = FinePayment(user_code=user_code, amount_paid=total,
                          payment_method='WALLET', notes='Thanh toán bằng tài khoản dịch vụ')
    db.add(payment)
    for fine in db.scalars(select(Fine).where(Fine.user_code == user_code,
                                  Fine.payment_status == 'UNPAID').with_for_update()).all():
        fine.payment_status = 'PAID'
    user.total_fines = Decimal('0')
    user.is_borrowing_blocked = False
    db.flush()
    return {'payment_id': payment.id, 'amount_paid': amount, 'balance_after': txn.balance_after,
            'total_fines': 0, 'is_borrowing_blocked': False}

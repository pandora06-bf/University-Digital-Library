from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional
from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.book import Book, BookCopy
from app.models.fine import Fine, FinePayment
from app.models.loan import Incident, Loan
from app.models.user import User


def send_checkout_receipt_email(user_email: str, loan_id: int, title: str, due_date: datetime):
    """Tiến trình gửi email biên lai chạy nền (UC12 / NFR-PE-03)"""
    # Tích hợp hàm gửi email thực tế qua fastapi-mail / SMTP
    pass


def promote_waitlist_stub(db: Session, book_id: int):
    """Kích hoạt kiểm tra hàng đợi đặt trước (BR-04, BR-08 / UC07)"""
    pass


# ----------------------------------------------------------------------
# 1. Tra cứu phiếu mượn
# ----------------------------------------------------------------------
def lookup_loans_service(db: Session, q: str):
    query = (
        select(Loan)
        .join(User, Loan.user_code == User.user_code)
        .join(Book, Loan.book_id == Book.id)
    )

    if q.isdigit():
        query = query.where(or_(Loan.id == int(q), Loan.user_code == q))
    else:
        query = query.where(Loan.user_code.ilike(f"%{q}%"))

    loans = db.scalars(query.order_by(Loan.borrow_date.desc())).all()
    return loans


# ----------------------------------------------------------------------
# 2. Check-out tại quầy (UC10)
# ----------------------------------------------------------------------
def checkout_at_counter_service(
    db: Session,
    background_tasks: BackgroundTasks,
    copy_barcode: str,
    loan_id: Optional[int] = None,
    user_code: Optional[str] = None,
    condition_notes: Optional[str] = None,
) -> Loan:
    # 1. Tìm phiếu mượn đang chờ nhận sách (REQUESTED hoặc PENDING_PICKUP)
    query = select(Loan).with_for_update()
    if loan_id:
        query = query.where(Loan.id == loan_id)
    elif user_code:
        query = query.where(
            Loan.user_code == user_code,
            Loan.loan_status.in_(["REQUESTED", "PENDING_PICKUP"])
        ).order_by(Loan.borrow_date.desc())
    else:
        raise HTTPException(status_code=400, detail="Cần cung cấp loan_id hoặc user_code")

    loan = db.scalar(query)
    if not loan:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu mượn hợp lệ để check-out")

    if loan.loan_status not in ["REQUESTED", "PENDING_PICKUP"]:
        raise HTTPException(
            status_code=409,
            detail=f"Phiếu mượn đang ở trạng thái {loan.loan_status}, không thể xuất mượn"
        )

    # 2. Kiểm tra bản sao sách vật lý (BookCopy)
    copy = db.scalar(select(BookCopy).where(BookCopy.copy_barcode == copy_barcode).with_for_update())
    if not copy:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy bản sao sách có mã {copy_barcode}")
    if copy.book_id != loan.book_id:
        raise HTTPException(status_code=409, detail="Bản sao sách này không thuộc đúng đầu sách của phiếu mượn")
    if copy.status != "AVAILABLE":
        raise HTTPException(status_code=409, detail=f"Bản sao sách đang ở trạng thái {copy.status}, không thể mượn")

    # 3. Chốt chặn người dùng: không bị khóa và Total_Fines = 0 (BR-01, BR-10)
    user = db.scalar(select(User).where(User.user_code == loan.user_code).with_for_update())
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ người mượn")
    if user.is_borrowing_blocked or user.total_fines > 0:
        raise HTTPException(status_code=403, detail="Người mượn đang bị khóa tài khoản hoặc có dư nợ phạt")

    # 4. Cập nhật trạng thái phiếu và bản sao
    now = datetime.now()
    copy.status = "BORROWED"
    copy.damage_notes = condition_notes

    loan.copy_barcode = copy_barcode
    loan.loan_status = "BORROWED"
    loan.borrow_date = now
    loan.due_date = now + timedelta(days=14)  # GĐ-04 / BR-17
    loan.checkout_condition = condition_notes

    db.commit()
    db.refresh(loan)

    # Gửi email biên lai chạy nền (NFR-PE-03 / UC12)
    book = db.scalar(select(Book).where(Book.id == loan.book_id))
    background_tasks.add_task(
        send_checkout_receipt_email,
        user_email=user.email,
        loan_id=loan.id,
        title=book.title if book else "",
        due_date=loan.due_date
    )
    return loan


# ----------------------------------------------------------------------
# 3. Check-in tại quầy (UC10)
# ----------------------------------------------------------------------
def checkin_at_counter_service(
    db: Session,
    copy_barcode: str,
    condition_notes: Optional[str] = None,
    is_lost: bool = False,
    is_damaged: bool = False,
    damage_penalty: Optional[Decimal] = None,
) -> dict:
    # 1. Tìm phiếu mượn đang BORROWED theo copy_barcode
    loan = db.scalar(
        select(Loan)
        .where(Loan.copy_barcode == copy_barcode, Loan.loan_status.in_(["BORROWED", "OVERDUE"]))
        .with_for_update()
    )
    if not loan:
        raise HTTPException(
            status_code=404,
            detail="Mã vạch không có phiếu mượn ở trạng thái BORROWED để check-in (E3)"
        )

    copy = db.scalar(select(BookCopy).where(BookCopy.copy_barcode == copy_barcode).with_for_update())
    book = db.scalar(select(Book).where(Book.id == loan.book_id).with_for_update())
    user = db.scalar(select(User).where(User.user_code == loan.user_code).with_for_update())
    now = datetime.now()

    # TRƯỜNG HỢP 1: Sách mất hoặc hỏng nặng -> Chuyển sang UC15
    if is_lost or is_damaged:
        loan.loan_status = "LOST" if is_lost else "RETURNED"
        loan.return_date = now
        loan.checkin_condition = condition_notes or ("Báo mất sách" if is_lost else "Sách hỏng nặng")

        if copy:
            copy.status = "RETIRED"  # Ngừng lưu hành (BR-29)

        # Tính tiền bồi thường: Giá bìa hoặc nhập thủ công (BR-28)
        penalty = Decimal(book.price) if (book and book.price > 0) else (damage_penalty or Decimal(100000))

        # Nếu quá hạn, chốt thêm tiền phạt trễ đến thời điểm báo (BR-28)
        overdue_fine = Decimal(0)
        if now > loan.due_date:
            days = (now.date() - loan.due_date.date()).days
            if days > 0:
                overdue_fine = Decimal(days) * Decimal(5000)
                fine_record = Fine(
                    loan_id=loan.id,
                    user_code=user.user_code,
                    overdue_days=days,
                    fine_rate=Decimal(5000),
                    total_amount=overdue_fine,
                    payment_status="UNPAID",
                    created_at=now,
                )
                db.add(fine_record)

        total_incident_penalty = penalty + overdue_fine

        incident = Incident(
            loan_id=loan.id,
            user_code=user.user_code,
            incident_type="BOOK_LOST" if is_lost else "BOOK_DAMAGED",
            severity="SEVERE",
            penalty_amount=total_incident_penalty,
            description=condition_notes,
            status="RESOLVED",
            created_at=now,
        )
        db.add(incident)

        user.total_fines += total_incident_penalty
        user.is_borrowing_blocked = True  # Khóa tài khoản (BR-15, BR-29)

        db.commit()
        return {
            "loan_id": loan.id,
            "status": loan.loan_status,
            "incident": "INCIDENT_RECORDED",
            "penalty_amount": total_incident_penalty,
            "message": "Đã chuyển sang biên bản sự cố UC15 và ghi nhận bồi thường"
        }

    # TRƯỜNG HỢP 2: Trả bình thường / quá hạn (BR-04, BR-21)
    loan.loan_status = "RETURNED"
    loan.return_date = now
    loan.checkin_condition = condition_notes

    if copy:
        copy.status = "AVAILABLE"
        copy.damage_notes = condition_notes

    # Tăng tồn kho sách khả dụng (+1) (BR-04, AC1)
    if book:
        book.available_stock += 1

    # Tính và chốt phạt trễ hạn nếu có (5.000 VNĐ / ngày) (BR-13, BR-21)
    fine_amount = Decimal(0)
    if now > loan.due_date:
        overdue_days = (now.date() - loan.due_date.date()).days
        if overdue_days > 0:
            fine_amount = Decimal(overdue_days) * Decimal(5000)
            fine_entry = Fine(
                loan_id=loan.id,
                user_code=user.user_code,
                overdue_days=overdue_days,
                fine_rate=Decimal(5000),
                total_amount=fine_amount,
                payment_status="UNPAID",
                created_at=now,
            )
            db.add(fine_entry)
            user.total_fines += fine_amount
            user.is_borrowing_blocked = True  # Khóa tài khoản khi có phạt (BR-15)

    db.commit()

    # Kích hoạt đôn hàng đợi chờ sách (UC07 / BR-04)
    promote_waitlist_stub(db, loan.book_id)

    return {
        "loan_id": loan.id,
        "loan_status": "RETURNED",
        "return_date": loan.return_date,
        "available_stock": book.available_stock if book else None,
        "overdue_fine": fine_amount,
        "message": "Check-in thành công"
    }


# ----------------------------------------------------------------------
# 4. Tra cứu phạt (UC10)
# ----------------------------------------------------------------------
def lookup_fines_service(db: Session, user_code: str):
    user = db.scalar(select(User).where(User.user_code == user_code))
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    unpaid_fines = db.scalars(
        select(Fine).where(Fine.user_code == user_code, Fine.payment_status == "UNPAID")
    ).all()

    return {
        "user_code": user.user_code,
        "full_name": user.full_name,
        "total_fines": user.total_fines,
        "is_borrowing_blocked": user.is_borrowing_blocked,
        "unpaid_count": len(unpaid_fines),
        "fines": [
            {
                "fine_id": f.id,
                "loan_id": f.loan_id,
                "overdue_days": f.overdue_days,
                "fine_rate": f.fine_rate,
                "total_amount": f.total_amount,
                "created_at": f.created_at,
            }
            for f in unpaid_fines
        ],
    }


# ----------------------------------------------------------------------
# 5. Thu phạt tại quầy (UC10 / BR-16, BR-34)
# ----------------------------------------------------------------------
def collect_counter_fines_service(
    db: Session,
    user_code: str,
    amount: Decimal,
    admin_collector_code: str,
    notes: Optional[str] = None
) -> FinePayment:
    # 1. Khóa dòng User để ngăn xung đột với luồng thanh toán ví online (with_for_update)
    user = db.scalar(select(User).where(User.user_code == user_code).with_for_update())
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    # 2. Kiểm tra nếu người dùng vừa trả trực tuyến (E6 / BR-34)
    if user.total_fines <= Decimal(0):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Công nợ đã được thanh toán (hoặc người dùng vừa trả trực tuyến bằng ví)"
        )

    # 3. Kiểm tra số tiền: Chỉ cho phép thu đủ toàn bộ, không thu một phần (E4 / BR-34)
    if amount != user.total_fines:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Số tiền nộp ({amount:,.0f} VNĐ) khác tổng nợ ({user.total_fines:,.0f} VNĐ). Chỉ hỗ trợ thu đủ toàn bộ."
        )

    # 4. Cập nhật các bản ghi Fine sang PAID
    unpaid_fines = db.scalars(
        select(Fine).where(Fine.user_code == user_code, Fine.payment_status == "UNPAID")
    ).all()
    for fine in unpaid_fines:
        fine.payment_status = "PAID"

    # 5. Ghi nhận biên lai vào FinePayment với method CASH (BR-34)
    payment = FinePayment(
        user_code=user_code,
        admin_collector_code=admin_collector_code,
        amount_paid=amount,
        payment_method="CASH",
        payment_date=datetime.now(),
        notes=notes or "Thu phạt trực tiếp tại quầy"
    )
    db.add(payment)

    # 6. Mở khóa và xóa công nợ: Total_Fines = 0, is_borrowing_blocked = FALSE (BR-16, AC3)
    user.total_fines = Decimal("0.00")
    user.is_borrowing_blocked = False

    db.commit()
    db.refresh(payment)
    return payment
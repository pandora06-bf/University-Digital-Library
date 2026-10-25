from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any
from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.book import Book, BookCopy
from app.models.fine import Fine, FinePayment
from app.models.loan import Incident, Loan
from app.models.user import User


def send_checkout_receipt_email(user_email: str, loan_id: int, title: str, due_date: datetime):
    """
    Gửi email biên lai ở chế độ nền (BackgroundTasks - UC12 / NFR-PE-03 / AC2)
    """
    # Tích hợp SMTP/fastapi-mail
    pass


def promote_waitlist_stub(db: Session, book_id: int):
    """
    Kích hoạt kiểm tra và đôn bạn đọc đầu hàng đợi sang HELD (UC07 / BR-04, BR-08)
    """
    pass


# ----------------------------------------------------------------------
# 1. Tra cứu phiếu mượn (Hỗ trợ màn hình quầy thủ thư)
# ----------------------------------------------------------------------
def lookup_loans_service(db: Session, q: str) -> List[Loan]:
    query = (
        select(Loan)
        .join(User, Loan.user_code == User.user_code)
        .join(Book, Loan.book_id == Book.id)
    )

    if q.isdigit():
        query = query.where(or_(Loan.id == int(q), Loan.user_code == q))
    else:
        query = query.where(Loan.user_code.ilike(f"%{q}%"))

    return list(db.scalars(query.order_by(Loan.borrow_date.desc())).all())


# ----------------------------------------------------------------------
# 2. Check-out tại quầy (POST /api/admin/loans/checkout)
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cần cung cấp mã phiếu mượn (loan_id) hoặc MSSV (user_code)"
        )

    loan = db.scalar(query)
    if not loan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy phiếu mượn hợp lệ để check-out (E1)"
        )

    if loan.loan_status not in ["REQUESTED", "PENDING_PICKUP"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Phiếu mượn đang ở trạng thái {loan.loan_status}, không thể xuất mượn"
        )

    # 2. Kiểm tra bản sao sách vật lý (BookCopy)
    copy = db.scalar(select(BookCopy).where(BookCopy.copy_barcode == copy_barcode).with_for_update())
    if not copy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy bản sao sách có mã vạch {copy_barcode} (E1)"
        )
    if copy.book_id != loan.book_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bản sao sách này không thuộc đúng đầu sách của phiếu mượn"
        )
    if copy.status != "AVAILABLE":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Bản sao sách đang ở trạng thái {copy.status}, không khả dụng (E1)"
        )

    # 3. Chốt chặn người dùng: không bị khóa và Total_Fines = 0 (BR-01, BR-10, E2)
    user = db.scalar(select(User).where(User.user_code == loan.user_code).with_for_update())
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy hồ sơ bạn đọc (E1)"
        )
    if user.is_borrowing_blocked or user.total_fines > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Người mượn đang bị khóa tài khoản hoặc có dư nợ phạt (E2)"
        )

    # 4. Cập nhật phiếu mượn & bản sao
    now = datetime.now()
    copy.status = "BORROWED"
    copy.damage_notes = condition_notes

    loan.copy_barcode = copy_barcode
    loan.loan_status = "BORROWED"
    loan.borrow_date = now
    loan.due_date = now + timedelta(days=14)  # GĐ-04 / BR-17 (Hạn 14 ngày)
    loan.checkout_condition = condition_notes  # BR-03 đồng kiểm tình trạng

    db.commit()
    db.refresh(loan)

    # Gửi email biên lai mượn sách ở chế độ nền (UC12 / AC2)
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
# 3. Check-in tại quầy (POST /api/admin/loans/checkin)
# ----------------------------------------------------------------------
def checkin_at_counter_service(
    db: Session,
    copy_barcode: str,
    condition_notes: Optional[str] = None,
    is_lost: bool = False,
    is_damaged: bool = False,
    damage_penalty: Optional[Decimal] = None,
) -> Dict[str, Any]:
    # 1. Tìm phiếu mượn BORROWED theo copy_barcode
    loan = db.scalar(
        select(Loan)
        .where(Loan.copy_barcode == copy_barcode, Loan.loan_status.in_(["BORROWED", "OVERDUE"]))
        .with_for_update()
    )
    if not loan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mã vạch không có phiếu mượn ở trạng thái BORROWED để check-in (E3)"
        )

    copy = db.scalar(select(BookCopy).where(BookCopy.copy_barcode == copy_barcode).with_for_update())
    book = db.scalar(select(Book).where(Book.id == loan.book_id).with_for_update())
    user = db.scalar(select(User).where(User.user_code == loan.user_code).with_for_update())
    now = datetime.now()

    # TRƯỜNG HỢP 1: Sách mất hoặc hỏng nặng -> Chuyển sang biên bản UC15
    if is_lost or is_damaged:
        loan.loan_status = "LOST" if is_lost else "RETURNED"
        loan.return_date = now
        loan.checkin_condition = condition_notes or ("Báo mất sách" if is_lost else "Sách hỏng nặng")

        if copy:
            copy.status = "RETIRED"  # Ngừng lưu hành bản sao (BR-29)

        # Tính bồi thường theo giá bìa hoặc thủ công (BR-28)
        penalty = Decimal(book.price) if (book and book.price > 0) else (damage_penalty or Decimal(100000))

        # Nếu đang quá hạn, chốt thêm tiền phạt trễ hạn tính đến thời điểm báo (BR-21, BR-28)
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
        user.is_borrowing_blocked = True  # Khóa quyền mượn (BR-15, BR-29)

        db.commit()
        return {
            "loan_id": loan.id,
            "status": loan.loan_status,
            "incident": "INCIDENT_RECORDED",
            "penalty_amount": total_incident_penalty,
            "message": "Đã lập biên bản sự cố UC15 và ghi nhận bồi thường"
        }

    # TRƯỜNG HỢP 2: Trả sách bình thường (BR-04, BR-21)
    loan.loan_status = "RETURNED"
    loan.return_date = now
    loan.checkin_condition = condition_notes

    if copy:
        copy.status = "AVAILABLE"
        copy.damage_notes = condition_notes

    # Tồn kho tăng đúng 1 (BR-04 / AC1)
    if book:
        book.available_stock += 1

    # Chốt tiền phạt trễ hạn nếu có: 5.000 VNĐ / ngày trễ (BR-13, BR-21, AC1)
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

    # Kích hoạt kiểm tra hàng đợi (UC07 / BR-04)
    promote_waitlist_stub(db, loan.book_id)

    # Trả về HTTP 200 ngay (AC2)
    return {
        "loan_id": loan.id,
        "loan_status": "RETURNED",
        "return_date": loan.return_date,
        "available_stock": book.available_stock if book else None,
        "overdue_fine": fine_amount,
        "message": "Check-in thành công"
    }


# ----------------------------------------------------------------------
# 4. Tra cứu nợ phạt (GET /api/admin/fines/lookup)
# ----------------------------------------------------------------------
def lookup_fines_service(db: Session, user_code: str) -> Dict[str, Any]:
    user = db.scalar(select(User).where(User.user_code == user_code))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy bạn đọc với MSSV {user_code} (E1)"
        )

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
# 5. Thu phạt tại quầy (POST /api/admin/fines/collect)
# ----------------------------------------------------------------------
def collect_counter_fines_service(
    db: Session,
    user_code: str,
    amount: Decimal,
    admin_collector_code: str,
    notes: Optional[str] = None
) -> Dict[str, Any]:
    # 1. Khóa dòng User để ngăn xung đột với luồng nộp online bằng ví (with_for_update)
    user = db.scalar(select(User).where(User.user_code == user_code).with_for_update())
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy bạn đọc {user_code}"
        )

    # 2. Xử lý ngoại lệ E6: Người dùng vừa trả trực tuyến bằng ví (BR-34)
    if user.total_fines <= Decimal(0):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Công nợ đã được thanh toán (hoặc người dùng vừa trả trực tuyến bằng ví) (E6)"
        )

    # 3. Xử lý ngoại lệ E4: Số tiền thu khác tổng nợ (Chỉ thu đủ toàn bộ, không thu một phần)
    if amount != user.total_fines:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Số tiền thu ({amount:,.0f} VNĐ) khác tổng nợ ({user.total_fines:,.0f} VNĐ). Chỉ hỗ trợ thu đủ toàn bộ (E4)."
        )

    # 4. Đánh dấu các bản ghi nợ phạt là đã thanh toán
    unpaid_fines = db.scalars(
        select(Fine).where(Fine.user_code == user_code, Fine.payment_status == "UNPAID")
    ).all()
    for fine in unpaid_fines:
        fine.payment_status = "PAID"

    # 5. Ghi nhận biên lai vào FinePayment với phương thức CASH (UC10 / BR-34)
    payment = FinePayment(
        user_code=user_code,
        admin_collector_code=admin_collector_code,
        amount_paid=amount,
        payment_method="CASH",
        payment_date=datetime.now(),
        notes=notes or "Thu phạt trực tiếp tại quầy"
    )
    db.add(payment)

    # 6. Mở khóa và xóa công nợ: Total_Fines = 0, is_borrowing_blocked = FALSE (BR-16 / AC3)
    user.total_fines = Decimal("0.00")
    user.is_borrowing_blocked = False

    # 7. Xử lý ngoại lệ E5: Kiểm tra xem bạn đọc còn sách quá hạn nào chưa trả không
    now = datetime.now()
    has_unreturned_overdue = db.scalar(
        select(Loan.id)
        .where(
            Loan.user_code == user_code,
            Loan.loan_status == "BORROWED",
            Loan.due_date < now
        )
        .limit(1)
    )

    db.commit()
    db.refresh(payment)

    warning_message = None
    if has_unreturned_overdue:
        warning_message = "Cảnh báo: Bạn đọc vẫn còn sách quá hạn chưa trả. Tiến trình đêm 00:00 sẽ tiếp tục tính phạt và khóa lại tài khoản (E5)."

    return {
        "payment": payment,
        "warning": warning_message
    }
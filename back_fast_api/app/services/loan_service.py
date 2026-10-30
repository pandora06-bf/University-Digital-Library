from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any
from uuid import uuid4
from fastapi import BackgroundTasks, HTTPException, status

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.database import SessionLocal
from app.models.book import Book, BookCopy
from app.models.fine import Fine, FinePayment
from app.models.loan import Incident, Loan, Waitlist
from app.models.user import User

# Trạng thái Loan được tính vào hạn mức mượn đồng thời (Active_Loans) của một
# bạn đọc: phiếu vật lý đang chờ nhận tại quầy, đang mượn, đang quá hạn, và
# eBook đang mượn (loan_type không phân biệt ở đây).
ACTIVE_LOAN_STATUSES = ("PENDING_PICKUP", "BORROWED", "OVERDUE")

# UC05: bạn đọc có 24 giờ để ra quầy nhận sách kể từ lúc đặt mượn, nếu không
# phiếu PENDING_PICKUP sẽ bị hủy và trả lại tồn kho (job quét định kỳ).
PICKUP_HOLD_PERIOD = timedelta(hours=24)


def send_checkout_receipt_email(user_email, loan_id, title, due_date, user_name="", author="", borrow_date=None):
    from app.services.email_notifier import send_receipt
    return send_receipt(user_email, user_name, loan_id, title, author, borrow_date, due_date)


def promote_waitlist_stub(db: Session, book_id: int):
    """Promote only after check-in; persist before any email is dispatched."""
    from app.services.waitlist_logic import promote_waitlist
    from app.services.email_notifier import send_hold
    from app.models.loan import Waitlist
    try:
        item = promote_waitlist(db, book_id)
        if item is None:
            db.commit()
            return None
        hold_id, code, expiry = item.id, item.user_code, item.hold_expires_at
        db.commit()
    except Exception:
        db.rollback()
        raise
    user = db.get(User, code)
    book = db.get(Book, book_id)
    if user and user.email and book:
        # Outside the database transaction: SMTP failures may not undo check-in.
        send_hold(user.email, user.full_name, book.title, hold_id, expiry)
    return hold_id


# ----------------------------------------------------------------------
# 1. Tra cứu phiếu mượn (Hỗ trợ màn hình quầy thủ thư)
# ----------------------------------------------------------------------
def lookup_loans_service(db: Session, q: str) -> List[Loan]:
    query = (
        select(Loan)
        .join(User, Loan.user_code == User.user_code)
        .join(Book, Loan.book_id == Book.id)
        .options(joinedload(Loan.book))
    )

    if q.isdigit():
        query = query.where(or_(Loan.id == int(q), Loan.user_code == q))
    else:
        query = query.where(Loan.user_code.ilike(f"%{q}%"))

    return list(db.scalars(query.order_by(Loan.borrow_date.desc())).all())


# ----------------------------------------------------------------------
# 1b. Yêu cầu mượn sách vật lý (POST /api/loans/physical/request) — 3-01.a
# ----------------------------------------------------------------------
def request_physical_loan_service(db: Session, user_code: str, book_id: int) -> Loan:
    """Tạo phiếu PENDING_PICKUP cho bạn đọc, giữ 1 bản sách tới quầy nhận trong
    24 giờ (UC05). Chốt chặn theo đúng thứ tự SRS, trong một transaction, khóa
    dòng sách bằng with_for_update() để tránh hai người giữ cùng bản cuối cùng:
      (1) tài khoản không bị khóa và không còn nợ phạt (Total_Fines = 0)
      (2) hạn mức mượn đồng thời Active_Loans < max_borrow_limit (tính cả
          PENDING_PICKUP/BORROWED/OVERDUE, vật lý lẫn eBook)
      (3) còn tồn kho khả dụng (Available_Stock > 0)
    """
    book = db.scalar(select(Book).where(Book.id == book_id).with_for_update())
    if book is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy sách"
        )
    if book.book_type != "PRINTED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sách này không có bản vật lý để đặt mượn tại quầy",
        )

    reader = db.scalar(select(User).where(User.user_code == user_code).with_for_update())
    if reader is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy hồ sơ bạn đọc"
        )

    # (1) Khóa tài khoản / nợ phạt
    if reader.is_borrowing_blocked or reader.total_fines > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đang bị khóa mượn hoặc còn nợ phạt chưa thanh toán",
        )

    # Không cho đặt trùng sách đang có phiếu còn hiệu lực
    duplicate = db.scalar(
        select(Loan.id)
        .where(
            Loan.user_code == reader.user_code,
            Loan.book_id == book_id,
            Loan.loan_status.in_(ACTIVE_LOAN_STATUSES),
        )
        .limit(1)
    )
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bạn đang có phiếu mượn hoặc đang chờ nhận sách này",
        )

    # (2) Hạn mức mượn đồng thời
    active_loans = (
        db.scalar(
            select(func.count(Loan.id)).where(
                Loan.user_code == reader.user_code,
                Loan.loan_status.in_(ACTIVE_LOAN_STATUSES),
            )
        )
        or 0
    )
    if active_loans >= reader.max_borrow_limit:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Đã đạt hạn mức mượn đồng thời ({reader.max_borrow_limit} phiếu)",
        )

    # (3) Tồn kho khả dụng
    if book.available_stock <= 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sách đã hết bản khả dụng, vui lòng Hẹn đặt trước",
        )

    now = datetime.now()
    loan = Loan(
        user_code=reader.user_code,
        book_id=book_id,
        loan_type="PHYSICAL",
        loan_status="PENDING_PICKUP",
        loan_code=f"PM-{now.year}-{uuid4().hex[:8].upper()}",
        borrow_date=now,
        due_date=now + timedelta(days=reader.max_borrow_days),
        pickup_deadline=now + PICKUP_HOLD_PERIOD,
    )
    db.add(loan)
    book.available_stock -= 1

    db.commit()
    db.refresh(loan)
    return loan


def run_pickup_expiry_job(session_factory=SessionLocal, now: Optional[datetime] = None) -> Dict[str, Any]:
    """Hủy các phiếu PENDING_PICKUP quá 24 giờ chưa tới quầy nhận sách, hoàn lại
    tồn kho. Theo SRS đây là JOB-03, nhưng id đó đã được dùng cho email nhắc
    hạn trong scheduler_worker.py hiện tại nên được đăng ký dưới id khác
    (xem app/scheduler_worker.py). Mỗi phiếu xử lý trong transaction riêng,
    một lỗi không chặn các phiếu còn lại (cùng kiểu với run_fine_job/JOB-01)."""
    now = now or datetime.now()
    db = session_factory()
    try:
        loan_ids = db.scalars(
            select(Loan.id).where(
                Loan.loan_status == "PENDING_PICKUP", Loan.pickup_deadline <= now
            )
        ).all()
    finally:
        db.close()

    cancelled = 0
    errors: List[int] = []
    for loan_id in loan_ids:
        db = session_factory()
        try:
            loan = db.scalar(select(Loan).where(Loan.id == loan_id).with_for_update())
            if loan is None or loan.loan_status != "PENDING_PICKUP":
                continue
            book = db.scalar(select(Book).where(Book.id == loan.book_id).with_for_update())
            loan.loan_status = "CANCELLED"
            if book is not None:
                book.available_stock += 1
            db.commit()
            cancelled += 1
        except Exception:
            db.rollback()
            errors.append(loan_id)
        finally:
            db.close()

    return {"cancelled": cancelled, "errors": errors}


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

    # Serialize checkout with waitlist promotions and check-in on the same book.
    # Available stock includes logically reserved (HELD) copies.
    book = db.scalar(select(Book).where(Book.id == loan.book_id).with_for_update())
    if book is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy đầu sách")
    now = datetime.utcnow()
    active_holds = list(db.scalars(
        select(Waitlist).where(
            Waitlist.book_id == loan.book_id,
            Waitlist.status == "HELD",
            Waitlist.hold_expires_at > now,
        ).order_by(Waitlist.queue_position, Waitlist.id)
    ).all())
    own_hold = next((item for item in active_holds if item.user_code == loan.user_code), None)
    if own_hold is None and book.available_stock <= len(active_holds):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sách đang được giữ cho người đặt trước khác (Waitlist HELD)",
        )
    if book.available_stock <= 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sách đã hết bản có thể giao",
        )

    # 4. Cập nhật phiếu mượn & bản sao và giải phóng lượt giữ trong một transaction.
    copy.status = "BORROWED"
    copy.damage_notes = condition_notes

    loan.copy_barcode = copy_barcode
    loan.loan_status = "BORROWED"
    loan.borrow_date = now
    loan.due_date = now + timedelta(days=14)  # GĐ-04 / BR-17 (Hạn 14 ngày)
    loan.checkout_condition = condition_notes  # BR-03 đồng kiểm tình trạng
    book.available_stock -= 1
    if own_hold is not None:
        db.delete(own_hold)
        db.flush()
        from app.services.waitlist_logic import compact_queue
        compact_queue(db, loan.book_id)

    db.commit()
    db.refresh(loan)

    # Gửi email biên lai mượn sách ở chế độ nền (UC12 / AC2)
    book = db.scalar(select(Book).where(Book.id == loan.book_id))
    background_tasks.add_task(
        send_checkout_receipt_email,
        user_email=user.email,
        loan_id=loan.id,
        title=book.title if book else "",
        due_date=loan.due_date,
        user_name=user.full_name,
        author=book.author if book else "",
        borrow_date=loan.borrow_date
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
    now = datetime.utcnow()

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
    now = datetime.utcnow()
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
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any
from uuid import uuid4
from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

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
PICKUP_HOLD_PERIOD = timedelta(hours=24)

def get_user_max_borrow_limit(user: User) -> int:
    """
    Xác định hạn mức mượn sách tối đa cùng lúc theo đối tượng bạn đọc (BR-01 / UC05):
    - Sinh viên (STUDENT): tối đa 3 cuốn
    - Giảng viên, viên chức (LECTURER, STAFF): tối đa 5 cuốn
    """
    user_role = (user.user_type or (user.account.role if user.account else "STUDENT")).strip().upper()
    if user_role in ("LECTURER", "STAFF"):
        return 5
    if user_role == "STUDENT":
        return 3
    return user.max_borrow_limit if (user.max_borrow_limit and user.max_borrow_limit > 0) else 3


def send_checkout_receipt_email(user_email: str, loan_id: int, title: str, due_date: datetime):
    """
    Gửi email biên lai ở chế độ nền (BackgroundTasks - UC12 / NFR-PE-03 / AC2)
    """
    # Tích hợp SMTP/fastapi-mail
    pass


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
#    Hỗ trợ cả 2 trường hợp:
#    - TH1: Đã đăng ký mượn sách trước trên Web (có loan_id hoặc phiếu REQUESTED/PENDING_PICKUP)
#    - TH2: Không đăng ký trước, tới trực tiếp quầy lấy sách mượn (nhập user_code + copy_barcode + condition_notes)
# ----------------------------------------------------------------------
def checkout_at_counter_service(
    db: Session,
    background_tasks: BackgroundTasks,
    copy_barcode: str,
    loan_id: Optional[int] = None,
    user_code: Optional[str] = None,
    condition_notes: Optional[str] = None,
    loan_code: Optional[str] = None,
    book_id: Optional[int] = None,
) -> Loan:
    if not loan_id and not loan_code and not user_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cần cung cấp mã phiếu mượn (id / loan_code) hoặc MSSV (user_code)"
        )

    # 1. Kiểm tra bản sao sách vật lý (BookCopy) và đầu sách (Book)
    copy = db.scalar(
        select(BookCopy).where(BookCopy.copy_barcode == copy_barcode).with_for_update()
    )
    if not copy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy bản sao sách có mã vạch {copy_barcode} (E1)"
        )
    if copy.status != "AVAILABLE":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Bản sao sách đang ở trạng thái {copy.status}, không khả dụng (E1)"
        )

    if book_id and book_id != copy.book_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="book_id không khớp với đầu sách của bản sao đã quét"
        )

    book = db.scalar(select(Book).where(Book.id == copy.book_id).with_for_update())
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy thông tin đầu sách của bản sao này (E1)"
        )

    # 2. Xác định phiếu mượn (nếu có đặt trước) hoặc chuẩn bị tạo mới (mượn trực tiếp tại quầy)
    loan: Optional[Loan] = None

    if loan_id or loan_code:
        # Trường hợp thủ thư nhập/quét mã phiếu mượn (id hoặc loan_code) đã đăng ký trước trên Web
        query = select(Loan).with_for_update()
        query = query.where(Loan.id == loan_id) if loan_id else query.where(Loan.loan_code == loan_code)
        loan = db.scalar(query)
        if not loan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy phiếu mượn hợp lệ để check-out (E1)"
            )
        if loan.loan_status not in ["REQUESTED", "PENDING_PICKUP"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Phiếu mượn đang ở trạng thái {loan.loan_status}, không thể xuất mượn (E1)"
            )
        if user_code and loan.user_code != user_code:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Mã bạn đọc (user_code) không khớp với phiếu mượn đã đăng ký"
            )
        if copy.book_id != loan.book_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Bản sao sách này không thuộc đúng đầu sách của phiếu mượn"
            )
    elif user_code:
        # Kiểm tra xem sinh viên có phiếu đăng ký trước cho đúng đầu sách này không
        loan = db.scalar(
            select(Loan)
            .where(
                Loan.user_code == user_code,
                Loan.book_id == copy.book_id,
                Loan.loan_status.in_(["REQUESTED", "PENDING_PICKUP"]),
            )
            .order_by(Loan.borrow_date.desc())
            .with_for_update()
        )

    # 3. Chốt chặn người dùng (UC05 / BR-01, BR-10, E1, E2):
    #    - MSSV phải tồn tại (E1 -> 404)
    #    - Không bị khóa thẻ, không nợ phạt, chưa vượt hạn mức mượn (E2 -> 403)
    target_user_code = loan.user_code if loan else user_code
    user = db.scalar(select(User).where(User.user_code == target_user_code).with_for_update())
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy hồ sơ bạn đọc với mã {target_user_code} (E1)"
        )

    if user.is_borrowing_blocked or user.total_fines > 0 or (user.account and not user.account.is_active):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Người mượn đang bị khóa tài khoản hoặc có dư nợ phạt (E2)"
        )

    # Hạn mức mượn tối đa cùng lúc: Sinh viên = 3 cuốn, Giảng viên/Viên chức = 5 cuốn (BR-01)
    max_limit = get_user_max_borrow_limit(user)

    now = datetime.now()
    borrow_days = user.max_borrow_days if (user.max_borrow_days and user.max_borrow_days > 0) else 14
    due_date = now + timedelta(days=borrow_days)  # GĐ-04 / BR-17 (Mặc định 14 ngày)

    # Kiểm tra danh sách giữ chỗ còn hiệu lực (Waitlist HELD)
    active_holds = list(db.scalars(
        select(Waitlist).where(
            Waitlist.book_id == copy.book_id,
            Waitlist.status == "HELD",
            Waitlist.hold_expires_at > now,
        ).order_by(Waitlist.queue_position, Waitlist.id)
    ).all())
    own_hold = next((item for item in active_holds if item.user_code == user.user_code), None)

    # Nếu người nhận không phải chính chủ giữ chỗ mà số sách khả dụng <= số lượng đang HELD -> Chặn lại
    if own_hold is None and book.available_stock <= len(active_holds):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sách đang được giữ cho người đặt trước khác (Waitlist HELD)",
        )

    # 4. Xử lý theo từng trường hợp
    if loan:
        # ------------------------------------------------------------------
        # TRƯỜNG HỢP A: Đã đăng ký mượn trước trên Web -> Cập nhật phiếu mượn
        # ------------------------------------------------------------------
        active_borrowed_count = db.scalar(
            select(func.count(Loan.id)).where(
                Loan.user_code == user.user_code,
                Loan.id != loan.id,
                Loan.loan_status.in_(["BORROWED", "OVERDUE"]),
            )
        ) or 0
        if active_borrowed_count >= max_limit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Người mượn đã đạt hạn mức mượn tối đa cùng lúc ({max_limit} cuốn) (E2)"
            )

        # PENDING_PICKUP đã trừ tồn kho lúc đặt trên Web -> không trừ lại.
        # REQUESTED (luồng cũ, chưa giữ chỗ) thì mới trừ tồn kho tại đây.
        if loan.loan_status == "REQUESTED":
            if book.available_stock <= 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Đầu sách này hiện không còn tồn kho khả dụng để xuất mượn (E1)"
                )
            book.available_stock -= 1

        loan.copy_barcode = copy_barcode
        loan.loan_status = "BORROWED"
        loan.borrow_date = now
        loan.due_date = due_date
        loan.checkout_condition = condition_notes  # BR-03 đồng kiểm tình trạng
    else:
        # ------------------------------------------------------------------
        # TRƯỜNG HỢP B: Không đăng ký trước -> Mượn trực tiếp tại quầy
        #               (Tạo bản ghi Loan mới với id tự tăng)
        # ------------------------------------------------------------------
        # Kiểm tra hạn mức mượn tối đa cùng lúc (SV: 3 cuốn, GV/VC: 5 cuốn - BR-01 / E2)
        active_loans_count = db.scalar(
            select(func.count(Loan.id)).where(
                Loan.user_code == user.user_code,
                Loan.loan_status.in_(["REQUESTED", "PENDING_PICKUP", "BORROWED", "OVERDUE"]),
            )
        ) or 0
        if active_loans_count >= max_limit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Người mượn đã đạt hạn mức mượn tối đa cùng lúc ({max_limit} cuốn) (E2)"
            )

        # Kiểm tra xem bạn đọc có đang mượn một cuốn khác của cùng đầu sách này không
        duplicate_loan = db.scalar(
            select(Loan.id).where(
                Loan.user_code == user.user_code,
                Loan.book_id == copy.book_id,
                Loan.loan_status.in_(["BORROWED", "OVERDUE"]),
            ).limit(1)
        )
        if duplicate_loan:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Bạn đọc đang mượn một bản sao của đầu sách này và chưa trả"
            )

        # Kiểm tra tồn kho khả dụng của đầu sách
        if book.available_stock <= 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Đầu sách này hiện không còn tồn kho khả dụng để xuất mượn (E1)"
            )

        # Nếu bạn đọc có trong hàng đợi (Waitlist) của đầu sách này thì xóa khỏi hàng đợi
        waitlist_entry = db.scalar(
            select(Waitlist).where(
                Waitlist.user_code == user.user_code,
                Waitlist.book_id == copy.book_id,
                Waitlist.status.in_(["WAITING", "HELD"]),
            )
        )
        if waitlist_entry:
            db.delete(waitlist_entry)

        # Giảm số lượng tồn kho khả dụng của đầu sách đi 1 khi mượn trực tiếp
        book.available_stock -= 1

        # Tạo bản ghi phiếu mượn mới (id tự động tăng)
        loan = Loan(
            user_code=user.user_code,
            book_id=copy.book_id,
            copy_barcode=copy_barcode,
            loan_type="PHYSICAL",
            loan_status="BORROWED",
            loan_code=f"PM-{now.year}-{uuid4().hex[:8].upper()}",
            borrow_date=now,
            due_date=due_date,
            renewal_count=0,
            checkout_condition=condition_notes,  # BR-03 đồng kiểm tình trạng
        )
        db.add(loan)

    # 5. Cập nhật trạng thái bản sao vật lý (BookCopy)
    copy.status = "BORROWED"
    copy.damage_notes = condition_notes

    # Giải phóng lượt giữ chỗ trong Waitlist nếu có
    if own_hold is not None:
        db.delete(own_hold)
        db.flush()
        from app.services.waitlist_logic import compact_queue
        compact_queue(db, copy.book_id)

    db.commit()
    db.refresh(loan)

    # 6. Gửi email biên lai mượn sách ở chế độ nền (UC12 / AC2)
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

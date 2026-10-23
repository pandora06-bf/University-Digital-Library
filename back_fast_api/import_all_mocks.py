"""Script nạp (import/seed) toàn bộ dữ liệu mock JSON vào Database.

Đảm bảo:
- Đọc các file trong thư mục mocks/ (hoặc /data/mocks/ trong Docker)
- Thứ tự nạp chuẩn ràng buộc FK:
  1. Subjects, Categories
  2. Accounts, Users
  3. Books, BookCopies, Ebooks
  4. Rooms
  5. Loans
  6. Fines & FinePayments
  7. Waitlists
  8. Incidents
  9. TopUps
  10. WalletTxns
  11. UnmatchedTx
- Idempotent: có thể chạy lại nhiều lần không trùng lặp (dựa vào PK hoặc mã duy nhất).
"""

import json
import os
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import (
    Account,
    Book,
    BookCopy,
    Category,
    Ebook,
    Fine,
    FinePayment,
    Incident,
    Loan,
    Room,
    RoomBooking,
    Subject,
    TopUp,
    UnmatchedTx,
    User,
    Waitlist,
    WalletTxn,
)


def _resolve_mock_path(filename: str) -> str:
    candidates = [
        os.path.join("/data/mocks", filename),
        os.path.join("mocks", filename),
        os.path.join("back_fast_api", "mocks", filename),
        os.path.join("..", "mocks", filename),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return os.path.join("mocks", filename)


def _load_json(filename: str):
    path = _resolve_mock_path(filename)
    if not os.path.exists(path):
        print(f"[WARN] Không tìm thấy file {path}")
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _parse_dt(val: str | None) -> datetime | None:
    if not val:
        return None
    return datetime.fromisoformat(val.replace("Z", "+00:00"))


def _parse_time(val: str | None):
    if not val:
        return None
    return datetime.strptime(val, "%H:%M:%S").time()


def seed_all_mocks():
    db = SessionLocal()
    default_password = "User@123"
    hashed_pw = hash_password(default_password)

    try:
        print("=== BẮT ĐẦU NẠP TOÀN BỘ MOCK DATA VÀO DATABASE ===")

        # 1. Subjects & Categories
        print("1. Đồng bộ Subjects & Categories...")
        for item in _load_json("subjects_mock.json"):
            if not db.get(Subject, item["subject_code"]):
                db.add(Subject(**item))

        for item in _load_json("categories_mock.json"):
            if not db.get(Category, item["id"]):
                db.add(Category(**item))
        db.flush()

        # 2. Accounts & Users
        accounts_by_id = {item["id"]: item for item in _load_json("accounts_mock.json")}
        users_mock = _load_json("users_mock.json")
        print(f"2. Nạp {len(users_mock)} Users...")
        for item in users_mock:
            acc_id = item["account_id"]
            user_code = item["user_code"]
            role = item.get("user_type", "STUDENT").strip().upper()

            account = db.get(Account, acc_id)
            if not account:
                account_data = accounts_by_id.get(acc_id, {})
                uname = account_data.get("username", item["email"].split("@")[0])
                if db.scalar(select(Account).where(Account.username == uname)):
                    uname = user_code.lower()
                account = Account(
                    id=acc_id,
                    username=uname,
                    password=hash_password(account_data.get("password", default_password)),
                    role=account_data.get("role", role),
                    is_active=account_data.get("is_active", True),
                )
                db.add(account)
                db.flush()

            if not db.get(User, user_code):
                u = User(
                    user_code=user_code,
                    account_id=account.id,
                    full_name=item["full_name"],
                    email=item["email"],
                    phone_number=item.get("phone_number"),
                    department=item.get("department", "Chung"),
                    academic_title=item.get("academic_title"),
                    user_type=role,
                    max_borrow_limit=item.get("max_borrow_limit", 3),
                    max_borrow_days=item.get("max_borrow_days", 14),
                    is_borrowing_blocked=item.get("is_borrowing_blocked", False),
                    total_fines=Decimal(str(item.get("total_fines", "0.00"))),
                    service_balance=item.get("service_balance", 0),
                    updated_at=_parse_dt(item.get("updated_at")) or datetime.now(),
                )
                db.add(u)
        db.flush()

        # 3. Books & BookCopies
        books_mock = _load_json("books_mock.json")
        print(f"3. Nạp {len(books_mock)} Sách và Bản sao...")
        for item in books_mock:
            bid = item["id"]
            if not db.get(Book, bid):
                b = Book(
                    id=bid,
                    title=item["title"],
                    author=item["author"],
                    publisher=item["publisher"],
                    publication_year=item["publication_year"],
                    price=item.get("price", 100000),
                    description=item.get("description"),
                    keywords=item.get("keywords"),
                    num_pages=item.get("num_pages"),
                    book_type=item.get("book_type", "PRINTED"),
                    available_stock=item.get("available_stock", 1),
                    category_id=item["category_id"],
                    subject_code=item["subject_code"],
                    created_at=_parse_dt(item.get("created_at")) or datetime.now(),
                )
                db.add(b)
                db.flush()

        db.flush()

        copies_by_book_id = {item["id"]: item for item in books_mock}
        for item in _load_json("book_copies_mock.json"):
            if not db.get(BookCopy, item["copy_barcode"]):
                db.add(BookCopy(**item))
        for item in _load_json("ebooks_mock.json"):
            if not db.get(Ebook, item["id"]):
                db.add(Ebook(**item))
        db.flush()

        # 4. Rooms
        rooms_mock = _load_json("rooms_mock.json")
        print(f"4. Nạp {len(rooms_mock)} Phòng học...")
        for r in rooms_mock:
            if not db.get(Room, r["id"]):
                db.add(
                    Room(
                        id=r["id"],
                        room_name=r["room_name"],
                        capacity=r["capacity"],
                        room_type=r.get("room_type", "STUDY"),
                        floor=r.get("floor", "1"),
                        is_active=r.get("is_active", True),
                        created_at=_parse_dt(r.get("created_at")) or datetime.now(),
                    )
                )
        db.flush()

        # 5. Loans
        loans_mock = _load_json("borrow_book.json")
        print(f"5. Nạp {len(loans_mock)} Giao dịch mượn trả...")
        for item in loans_mock:
            lid = item["id"]
            if not db.get(Loan, lid):
                user_code = item.get("student_code") or item.get("user_code")
                barcode = item.get("copy_barcode")
                if barcode and not db.get(BookCopy, barcode):
                    db.add(
                        BookCopy(
                            copy_barcode=barcode,
                            book_id=item["book_id"],
                            zone="A",
                            floor="1",
                            shelf="101",
                            status="BORROWED",
                        )
                    )
                    db.flush()

                new_loan = Loan(
                    id=lid,
                    user_code=user_code,
                    book_id=item["book_id"],
                    copy_barcode=barcode,
                    loan_type=item["loan_type"],
                    loan_status=item["loan_status"],
                    borrow_date=_parse_dt(item.get("borrow_date")) or datetime.now(),
                    due_date=_parse_dt(item.get("due_date")) or datetime.now(),
                    return_date=_parse_dt(item.get("return_date")),
                    renewal_count=item.get("renewal_count", 0),
                    checkout_condition=item.get("checkout_condition"),
                    checkin_condition=item.get("checkin_condition"),
                    ebook_access_token=item.get("ebook_access_token"),
                )
                db.add(new_loan)
        db.flush()

        # 6. Fines & FinePayments
        fines_mock = _load_json("fines_mock.json")
        print(f"6. Nạp {len(fines_mock)} Tiền phạt...")
        for f in fines_mock:
            if not db.get(Fine, f["id"]):
                db.add(
                    Fine(
                        id=f["id"],
                        loan_id=f["loan_id"],
                        user_code=f["user_code"],
                        overdue_days=f["overdue_days"],
                        fine_rate=Decimal(str(f.get("fine_rate", "5000.00"))),
                        total_amount=Decimal(str(f["total_amount"])),
                        payment_status=f.get("payment_status", "UNPAID"),
                        created_at=_parse_dt(f.get("created_at")) or datetime.now(),
                    )
                )
        db.flush()

        payments_mock = _load_json("fine_payments_mock.json")
        print(f"   Nạp {len(payments_mock)} Lịch sử thu phạt...")
        for p in payments_mock:
            if not db.get(FinePayment, p["id"]):
                db.add(
                    FinePayment(
                        id=p["id"],
                        user_code=p["user_code"],
                        admin_collector_code=p.get("admin_collector_code"),
                        amount_paid=Decimal(str(p["amount_paid"])),
                        payment_method=p["payment_method"],
                        payment_date=_parse_dt(p.get("payment_date")) or datetime.now(),
                        notes=p.get("notes"),
                    )
                )
        db.flush()

        # 7. Waitlists
        waitlists_mock = _load_json("waitlists_mock.json")
        print(f"7. Nạp {len(waitlists_mock)} Đặt trước (Waitlist)...")
        for w in waitlists_mock:
            if not db.get(Waitlist, w["id"]):
                db.add(
                    Waitlist(
                        id=w["id"],
                        user_code=w["user_code"],
                        book_id=w["book_id"],
                        queue_position=w["queue_position"],
                        status=w.get("status", "WAITING"),
                        hold_expires_at=_parse_dt(w.get("hold_expires_at")),
                        created_at=_parse_dt(w.get("created_at")) or datetime.now(),
                    )
                )
        db.flush()

        # 8. Room Bookings
        rbookings_mock = _load_json("room_bookings_mock.json")
        print(f"8. Nạp {len(rbookings_mock)} Lượt đặt phòng...")
        for rb in rbookings_mock:
            if not db.get(RoomBooking, rb["id"]):
                db.add(
                    RoomBooking(
                        id=rb["id"],
                        room_id=rb["room_id"],
                        user_code=rb["user_code"],
                        booking_date=datetime.strptime(rb["booking_date"], "%Y-%m-%d").date(),
                        slot_start=_parse_time(rb["slot_start"]),
                        slot_end=_parse_time(rb["slot_end"]),
                        status=rb.get("status", "CONFIRMED"),
                        checkin_time=_parse_dt(rb.get("checkin_time")),
                        notes=rb.get("notes"),
                        created_at=_parse_dt(rb.get("created_at")) or datetime.now(),
                    )
                )
        db.flush()

        # 9. Incidents
        incidents_mock = _load_json("incidents_mock.json")
        print(f"9. Nạp {len(incidents_mock)} Sự cố sách/tài sản...")
        for inc in incidents_mock:
            if not db.get(Incident, inc["id"]):
                db.add(
                    Incident(
                        id=inc["id"],
                        loan_id=inc.get("loan_id"),
                        user_code=inc["user_code"],
                        incident_type=inc["incident_type"],
                        severity=inc.get("severity", "NORMAL"),
                        penalty_amount=Decimal(str(inc.get("penalty_amount", "0.00"))),
                        description=inc.get("description"),
                        status=inc.get("status", "PENDING"),
                        created_at=_parse_dt(inc.get("created_at")) or datetime.now(),
                    )
                )
        db.flush()

        # 10. TopUps
        topups_mock = _load_json("top_ups_mock.json")
        print(f"10. Nạp {len(topups_mock)} Yêu cầu nạp ví...")
        for tu in topups_mock:
            if not db.get(TopUp, tu["id"]):
                db.add(
                    TopUp(
                        id=tu["id"],
                        user_code=tu["user_code"],
                        amount=tu["amount"],
                        pay_code=tu["pay_code"],
                        bank_tx_id=tu.get("bank_tx_id"),
                        status=tu.get("status", "PENDING"),
                        expired_at=_parse_dt(tu["expired_at"]),
                        created_at=_parse_dt(tu.get("created_at")) or datetime.now(),
                    )
                )
        db.flush()

        # 11. WalletTxns
        wallet_mock = _load_json("wallet_txns_mock.json")
        print(f"11. Nạp {len(wallet_mock)} Giao dịch ví...")
        for tx in wallet_mock:
            if not db.get(WalletTxn, tx["id"]):
                db.add(
                    WalletTxn(
                        id=tx["id"],
                        user_code=tx["user_code"],
                        txn_type=tx["txn_type"],
                        amount=tx["amount"],
                        balance_before=tx["balance_before"],
                        balance_after=tx["balance_after"],
                        reference_id=tx.get("reference_id"),
                        description=tx.get("description"),
                        created_at=_parse_dt(tx.get("created_at")) or datetime.now(),
                    )
                )
        db.flush()

        # The original users fixture predates service_balance. Derive its value
        # from each user's last wallet transaction so the added fixtures remain
        # compatible with that unchanged source file.
        balances = {}
        for tx in sorted(wallet_mock, key=lambda row: (row.get("created_at", ""), row["id"])):
            balances[tx["user_code"]] = tx["balance_after"]
        for user_code, balance in balances.items():
            user = db.get(User, user_code)
            if user is not None:
                user.service_balance = balance
        db.flush()

        # 12. UnmatchedTx
        unmatched_mock = _load_json("unmatched_tx_mock.json")
        print(f"12. Nạp {len(unmatched_mock)} Giao dịch chưa khớp...")
        for un in unmatched_mock:
            if not db.get(UnmatchedTx, un["id"]):
                db.add(
                    UnmatchedTx(
                        id=un["id"],
                        bank_tx_id=un["bank_tx_id"],
                        amount=un["amount"],
                        bank_account_number=un.get("bank_account_number"),
                        transfer_content=un["transfer_content"],
                        received_at=_parse_dt(un["received_at"]),
                        status=un.get("status", "UNRESOLVED"),
                        resolved_by=un.get("resolved_by"),
                        resolution_notes=un.get("resolution_notes"),
                        created_at=_parse_dt(un.get("created_at")) or datetime.now(),
                    )
                )
        db.flush()

        db.commit()
        print(" -> ĐÃ NẠP THÀNH CÔNG 100% CÁC BẢNG TỪ TẤT CẢ FILE MOCK JSON!")
        print("=== HOÀN TẤT IDEMPOTENT IMPORT ===")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Lỗi khi nạp mock data: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_all_mocks()

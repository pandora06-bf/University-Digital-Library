"""Seed repeatable development/demo data after applying Alembic migrations.

Sprint 2C - Lợi (3-21, 4-21):
  - Mở rộng seeder với:
    + Lịch đặt phòng mẫu (đủ 5 trạng thái: CONFIRMED, CHECKED_IN, COMPLETED, CANCELLED, NO_SHOW)
    + Số dư và lịch sử giao dịch ví mẫu (TOPUP, BOOKING_PAYMENT, REFUND, FINE_PAYMENT)
    + Vài giao dịch chưa khớp (UnmatchedTx) để demo UC16
    + Dữ liệu demo cho tất cả 16 UC: sách quá hạn, giữ chỗ, phiếu phạt, báo mất/hỏng
  - Giữ idempotent (chạy lại nhiều lần vẫn đúng)
  - Dùng chung cho môi trường dev và demo
"""

import os
import random
from datetime import datetime, timedelta

from faker import Faker

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


fake = Faker("vi_VN")
fake.seed_instance(20261016)
DEMO_PASSWORD = "User@123"
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin").strip()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin@123")

# Offset UTC → giờ Việt Nam, CHỈ dùng để tính booking_date và hiển thị.
# Tất cả timestamp lưu DB đều là UTC-naive (khớp với backend service).
_VN_OFFSET = timedelta(hours=7)

# ─── Dữ liệu danh mục ───────────────────────────────────────────────────────

CATEGORIES = [
    "Công nghệ thông tin",
    "Khoa học",
    "Văn học",
    "Kinh tế",
    "Ngoại ngữ",
]
SUBJECTS = [
    ("IT",   "Công nghệ thông tin", "Khoa Công nghệ thông tin"),
    ("MATH", "Toán học",            "Khoa Khoa học cơ bản"),
    ("PHYS", "Vật lý",              "Khoa Khoa học cơ bản"),
    ("LIT",  "Văn học",             "Khoa Ngữ văn"),
    ("ECO",  "Kinh tế",             "Khoa Kinh tế"),
    ("ENG",  "Tiếng Anh",           "Khoa Ngoại ngữ"),
]
# Đủ 5 category → 5 subject (trừ PHYS không có category riêng trong demo)
CATEGORY_SUBJECT = {
    "Công nghệ thông tin": "IT",
    "Khoa học": "MATH",
    "Văn học": "LIT",
    "Kinh tế": "ECO",
    "Ngoại ngữ": "ENG",
}

# ─── Helper ─────────────────────────────────────────────────────────────────

def _utcnow() -> datetime:
    """Trả về datetime.utcnow() – UTC-naive, khớp với quy ước backend."""
    return datetime.utcnow()


def _get_or_create(db, model, lookup, **values):
    instance = db.query(model).filter_by(**lookup).one_or_none()
    if instance is None:
        instance = model(**lookup, **values)
        db.add(instance)
        db.flush()
    return instance


def _seed_user(db, *, username, role, user_code, name, email, password, balance=0):
    account = _get_or_create(
        db,
        Account,
        {"username": username},
        password=hash_password(password),
        role=role,
        is_active=True,
    )
    account.role = role
    account.is_active = True
    user = db.query(User).filter_by(user_code=user_code).one_or_none()
    if user is None:
        user = User(
            user_code=user_code,
            account_id=account.id,
            full_name=name,
            email=email,
            department="Thư viện" if role == "ADMIN" else "Khoa Công nghệ thông tin",
            user_type=role,
            max_borrow_limit=0 if role == "ADMIN" else (5 if role == "LECTURER" else 3),
            max_borrow_days=0 if role == "ADMIN" else 14,
            service_balance=balance,
        )
        db.add(user)
        db.flush()
    else:
        # Tài khoản demo do script quản lý bắt đầu từ 0; các giao dịch phía
        # dưới sẽ tính lại số dư chính xác từ ledger.
        if username.startswith("demo_"):
            user.service_balance = balance
    return user


# ────────────────────────────────────────────────────────────────────────────
# Seeder chính
# ────────────────────────────────────────────────────────────────────────────

def seed_database():
    """Insert/reconcile this seeder's stable demo rows without touching user data.

    Run ``alembic upgrade head`` before invoking this script. The stable demo
    keys make this safe to run repeatedly and allow partially seeded databases
    to be completed later. Rows carrying this seeder's stable demo keys are
    reconciled; unrelated accounts and transactions are preserved.
    """
    if not ADMIN_USERNAME or not ADMIN_PASSWORD:
        raise ValueError("ADMIN_USERNAME và ADMIN_PASSWORD không được để trống")

    fake.seed_instance(20261016)
    rng = random.Random(20261016)
    now = _utcnow()       # UTC-naive – dùng cho tất cả timestamp DB
    vn_now = now + _VN_OFFSET  # Cùng một thời điểm với now, đổi sang ngày/giờ VN
    db = SessionLocal()
    try:
        # ── 1. Categories & Subjects ────────────────────────────────────────
        categories = {
            name: _get_or_create(db, Category, {"category_name": name})
            for name in CATEGORIES
        }
        subjects = {
            code: _get_or_create(
                db,
                Subject,
                {"subject_code": code},
                subject_name=name,
                department_name=department,
            )
            for code, name, department in SUBJECTS
        }

        # ── 2. Users ────────────────────────────────────────────────────────
        # Admin cố định
        admin_user = _seed_user(
            db,
            username=ADMIN_USERNAME,
            role="ADMIN",
            user_code="ADMIN-0001",
            name="Quản trị viên thư viện",
            email="admin@library.local",
            password=ADMIN_PASSWORD,
        )

        # 100 người dùng demo (sinh viên / giảng viên)
        for index in range(1, 101):
            role = "STUDENT" if index % 2 else "LECTURER"
            prefix = "SV" if role == "STUDENT" else "GV"
            _seed_user(
                db,
                username=f"demo_{role.lower()}_{index:03d}",
                role=role,
                user_code=f"{prefix}-DEMO-{index:03d}",
                name=fake.name(),
                email=f"demo.user.{index:03d}@library.local",
                password=DEMO_PASSWORD,
                # Wallet balances are derived from the explicit ledger below.
                balance=0,
            )
        db.flush()

        # ── 3. Books + Copies + Ebooks ──────────────────────────────────────
        for index in range(1, 101):
            title = f"[DEMO-{index:03d}] {fake.catch_phrase()}"
            book = _get_or_create(
                db,
                Book,
                {"title": title},
                author=fake.name(),
                publisher=fake.company(),
                publication_year=int(fake.year()),
                price=rng.randrange(5, 61) * 5_000,
                description=fake.text(max_nb_chars=240),
                keywords=" ".join(fake.words(nb=4, unique=True)),
                num_pages=rng.randint(80, 800),
                book_type="BOTH" if index % 3 == 0 else (
                    "EBOOK" if index % 3 == 1 else "PRINTED"
                ),
                available_stock=0,
                category_id=categories[CATEGORIES[(index - 1) % len(CATEGORIES)]].id,
                subject_code=CATEGORY_SUBJECT[CATEGORIES[(index - 1) % len(CATEGORIES)]],
            )
            book.price = book.price or rng.randrange(5, 61) * 5_000
            # Fixture books always follow the matching category/subject pair.
            book.subject_code = CATEGORY_SUBJECT[CATEGORIES[(index - 1) % len(CATEGORIES)]]

            copy_count = rng.randint(1, 3)
            existing_copy_count = db.query(BookCopy).filter_by(book_id=book.id).count()
            for copy_index in range(existing_copy_count + 1, copy_count + 1):
                copy = BookCopy(
                    copy_barcode=f"DEMO-BC-{index:03d}-{copy_index:02d}",
                    book_id=book.id,
                    zone=chr(ord("A") + (index % 4)),
                    floor=str(1 + index % 3),
                    shelf=f"{100 + index:03d}",
                    status="AVAILABLE",
                )
                db.add(copy)
                book.available_stock = (book.available_stock or 0) + 1

            if book.book_type in {"EBOOK", "BOTH"} and \
                    db.query(Ebook).filter_by(id=book.id).first() is None:
                db.add(
                    Ebook(
                        id=book.id,
                        file_path=f"demo/ebook-{index:03d}.pdf",
                        is_free=index % 5 == 0,
                    )
                )

        # ── 4. Rooms ────────────────────────────────────────────────────────
        ROOM_DEFS = [
            {"room_name": "Phòng học nhóm 01", "capacity": 6,  "floor": "1"},
            {"room_name": "Phòng học nhóm 02", "capacity": 8,  "floor": "2"},
            {"room_name": "Phòng học nhóm 03", "capacity": 10, "floor": "3"},
            {"room_name": "Phòng hội thảo 04", "capacity": 20, "floor": "4"},
        ]
        rooms = []
        for rd in ROOM_DEFS:
            r = _get_or_create(
                db,
                Room,
                {"room_name": rd["room_name"]},
                capacity=rd["capacity"],
                room_type="STUDY",
                floor=rd["floor"],
                is_active=True,
            )
            rooms.append(r)
        db.flush()

        # ── 5. Demo Loans + Waitlists – trạng thái và tồn kho nhất quán ────
        books_all = db.query(Book).filter(
            Book.title.like("[DEMO-%")
        ).order_by(Book.id).all()
        _seed_demo_loans_and_waitlists(db, books_all, now)
        db.flush()


        # ── 7. RoomBookings – đủ 5 trạng thái (3-21 – UC14) ────────────────
        _seed_room_bookings(db, rooms, now, vn_now)
        db.flush()

        # ── 8. TopUps & WalletTxns (3-21 – UC16) ───────────────────────────
        _seed_wallet_data(db, now)
        db.flush()

        # ── 9. UnmatchedTx (3-21 – UC16 giao dịch chưa khớp) ──────────────
        _seed_unmatched_tx(db, now)
        db.flush()

        # ── 10. FinePayments demo (UC08/UC10) ───────────────────────────────
        _seed_fine_payments(db, now)
        db.flush()

        db.commit()
        print("=" * 60)
        print("Seed hoàn tất (Sprint 2C – 3-21 + 4-21):")
        print("  - 100 sách, 101 hồ sơ (gồm ADMIN), 4 phòng")
        print("  - Dữ liệu demo đủ 16 UC")
        print(f"Tài khoản ADMIN: {ADMIN_USERNAME} / {ADMIN_PASSWORD}")
        print(f"Tài khoản mẫu:   demo_student_001 / {DEMO_PASSWORD}")
        print("=" * 60)

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ── Hàm seed con ──────────────────────────────────────────────────────────────

# Ghi chú cũ (dạng mô tả) do phiên bản seeder trước tạo ra.
# Dùng để nhận lại và cập nhật chúng thay vì tạo bản ghi trùng.
_LEGACY_RB_NOTES = {
    "DEMO-RB-001": "Học nhóm môn Lập trình Web",
    "DEMO-RB-002": "Họp nhóm đồ án tốt nghiệp",
    "DEMO-RB-003": "Thảo luận báo cáo cuối kỳ",
    "DEMO-RB-004": "Hủy trước 2 giờ – được hoàn tiền",
    "DEMO-RB-005": "Không đến sau 15 phút – JOB-06 chuyển NO_SHOW",
    "DEMO-RB-006": "Buổi hướng dẫn đồ án – ngày mai",
}


def _seed_room_bookings(db, rooms, now: datetime, vn_now: datetime) -> None:
    """Tạo lượt đặt phòng demo đủ 5 trạng thái.

    Quy ước timestamp:
      - booking_date dùng giờ VN (vn_now) vì đây là ngày lịch người dùng nhìn.
      - checkin_time và created_at lưu UTC-naive (now) khớp backend.

    Idempotent:
      - Tra cứu theo notes = "DEMO-RB-xxx" (stable key hiện tại).
      - Nếu không tìm thấy, thử nhận lại ghi chú cũ dạng mô tả (_LEGACY_RB_NOTES)
        để tránh tạo bản ghi trùng và đụng partial unique index.

    CHECKED_IN dùng khung hai giờ chứa thời điểm chạy seeder theo giờ VN.
    Điều này giữ check-in không ở tương lai hoặc ngoài khung giờ, bất kể script
    chạy buổi sáng, tối hay qua nửa đêm. Timestamp check-in lưu UTC-naive;
    giờ đặt phòng là giờ địa phương VN.
    """
    if not rooms:
        return

    from datetime import time as _time

    # ── Tính ngày booking dựa trên giờ Việt Nam ──────────────────────────────
    vn_today       = vn_now.date()
    vn_yesterday   = (vn_now - timedelta(days=1)).date()
    vn_tomorrow    = (vn_now + timedelta(days=1)).date()
    vn_2days_ago   = (vn_now - timedelta(days=2)).date()
    vn_3days_ago   = (vn_now - timedelta(days=3)).date()

    # Các slot fixture dài 2 giờ và theo giờ địa phương Việt Nam. Chia ngày
    # thành 12 slot để CHECKED_IN luôn đại diện một lượt đang diễn ra.
    checked_in_date = vn_today
    slot_hour = (vn_now.hour // 2) * 2
    ci_slot_start = _time(slot_hour, 0)
    ci_slot_end = (
        _time(23, 59, 59, 999999)
        if slot_hour == 22
        else _time(slot_hour + 2, 0)
    )
    # now và vn_now được tạo từ cùng một datetime nên quy đổi UTC/VN chính xác.
    checkin_utc = now
    if (checkin_utc + _VN_OFFSET).time() >= ci_slot_end:
        checkin_utc -= timedelta(microseconds=1)

    # ── COMPLETED: hôm qua slot cố định 08:00–10:00 ──────────────────────────
    completed_date    = vn_yesterday
    completed_checkin = datetime(
        vn_yesterday.year, vn_yesterday.month, vn_yesterday.day,
        1, 10          # UTC 01:10 ≡ VN 08:10 – trong slot
    )

    # ── Bảng định nghĩa fixture ───────────────────────────────────────────────
    # (ref, room_idx, user_code, booking_date, slot_start, slot_end, status, checkin_utc_or_None)
    definitions = [
        # 1. COMPLETED – hôm qua, đã xong, check-in trong slot
        ("DEMO-RB-001", 0, "SV-DEMO-001",
         completed_date,  "08:00", "10:00", "COMPLETED", completed_checkin),
        # 2. CHECKED_IN – slot hai giờ hiện tại theo giờ Việt Nam
        ("DEMO-RB-002", 1, "SV-DEMO-003",
         checked_in_date, ci_slot_start, ci_slot_end, "CHECKED_IN", checkin_utc),
        # 3. CONFIRMED – ngày mai, chưa đến
        ("DEMO-RB-003", 2, "SV-DEMO-005",
         vn_tomorrow,    "14:00", "16:00", "CONFIRMED",  None),
        # 4. CANCELLED – 3 ngày trước, đã hủy, hoàn tiền
        ("DEMO-RB-004", 0, "GV-DEMO-004",
         vn_3days_ago,   "16:00", "18:00", "CANCELLED",  None),
        # 5. NO_SHOW – 2 ngày trước, đặt mà không đến
        ("DEMO-RB-005", 1, "SV-DEMO-007",
         vn_2days_ago,   "08:00", "10:00", "NO_SHOW",    None),
        # 6. CONFIRMED – ngày mai, giảng viên hướng dẫn đồ án
        ("DEMO-RB-006", 3, "GV-DEMO-006",
         vn_tomorrow,    "10:00", "12:00", "CONFIRMED",  None),
    ]

    for ref, room_idx, user_code, booking_date, start_str, end_str, status, checkin_dt in definitions:
        user = db.query(User).filter_by(user_code=user_code).first()
        if not user:
            continue
        room = rooms[min(room_idx, len(rooms) - 1)]
        start_time = start_str if isinstance(start_str, _time) else datetime.strptime(start_str, "%H:%M").time()
        end_time = end_str if isinstance(end_str, _time) else datetime.strptime(end_str, "%H:%M").time()

        # Tra cứu theo stable key trước, fallback sang ghi chú cũ (Issue 4)
        booking = db.query(RoomBooking).filter_by(notes=ref).one_or_none()
        if booking is None:
            legacy_note = _LEGACY_RB_NOTES.get(ref)
            if legacy_note:
                booking = db.query(RoomBooking).filter_by(notes=legacy_note).one_or_none()
                if booking is not None:
                    booking.notes = ref  # nâng cấp lên stable key
        if booking is None:
            booking = RoomBooking(notes=ref)
            db.add(booking)

        # UTC-naive cho tất cả timestamp DB
        created_utc = now - timedelta(days=4 if status in {"CANCELLED", "NO_SHOW"} else 2)
        booking.room_id      = room.id
        booking.user_code    = user_code
        booking.booking_date = booking_date
        booking.slot_start   = start_time
        booking.slot_end     = end_time
        booking.status       = status
        booking.checkin_time = checkin_dt  # đã là UTC hoặc None
        booking.created_at   = created_utc
        db.flush()


def _seed_wallet_data(db, now):
    """Tạo TopUp và ledger ví có số dư chạy cộng dồn khớp từng giao dịch."""
    topups = [
        ("SV-DEMO-001", 100_000, "PAY-DEMO-001-A", "BANK-DEMO-001-A", "PAID", -9),
        ("SV-DEMO-001", 200_000, "PAY-DEMO-001-B", "BANK-DEMO-001-B", "PAID", -6),
        ("SV-DEMO-003", 150_000, "PAY-DEMO-003-A", "BANK-DEMO-003-A", "PAID", -8),
        ("GV-DEMO-004", 30_000, "PAY-DEMO-004-A", "BANK-DEMO-004-A", "PAID", -5),
        ("SV-DEMO-005", 50_000, "PAY-DEMO-005-A", "BANK-DEMO-005-A", "PAID", -4),
        ("SV-DEMO-011", 100_000, "PAY-DEMO-011-A", "BANK-DEMO-011-A", "PAID", -5),
        ("SV-DEMO-007", 100_000, "PAY-DEMO-007-P", None, "PENDING", 0),
        ("SV-DEMO-009", 50_000, "PAY-DEMO-009-E", None, "EXPIRED", -1),
    ]
    for user_code, amount, pay_code, bank_tx, status, day_offset in topups:
        if not db.query(User).filter_by(user_code=user_code).first():
            continue
        row = db.query(TopUp).filter_by(pay_code=pay_code).one_or_none()
        if row is None:
            row = TopUp(pay_code=pay_code)
            db.add(row)
        created = now + timedelta(days=day_offset) if status != "PENDING" else now - timedelta(minutes=5)
        row.user_code = user_code
        row.amount = amount
        row.bank_tx_id = bank_tx
        row.status = status
        row.created_at = created
        row.expired_at = created + timedelta(minutes=15)

    # Remove only transaction/payment fixtures created by the earlier version
    # of this same demo seeder; these have stable DEMO references/notes.
    legacy_refs = [
        "PAY-20261015-D001", "PAY-20261018-D001", "RB-DEMO-001",
        "PAY-20261016-D003", "RB-DEMO-002", "PAY-20261020-D005",
        "PAY-20261019-D002", "RB-DEMO-003", "FINE-DEMO-003",
        "PAY-20261022-D007", "PAY-20261023-D009",
    ]
    db.query(WalletTxn).filter(WalletTxn.reference_id.in_(legacy_refs)).delete(synchronize_session=False)
    db.query(TopUp).filter(TopUp.pay_code.in_([
        "PAY-20261015-D001", "PAY-20261018-D001", "PAY-20261016-D003",
        "PAY-20261020-D005", "PAY-20261019-D002", "PAY-20261022-D007",
        "PAY-20261023-D009",
    ])).delete(synchronize_session=False)
    db.query(FinePayment).filter(FinePayment.notes.in_([
        "Thu phạt trễ hạn 6 ngày tại quầy",
        "Thu phạt bồi thường sách mất",
        "Trả phạt qua tài khoản dịch vụ (UC10)",
    ])).delete(synchronize_session=False)
    db.flush()

    # Each user's events are ordered by time; balances are derived, never guessed.
    events = [
        ("SV-DEMO-001", "TOPUP", 100_000, "PAY-DEMO-001-A", "Nạp tiền đã đối soát", -9),
        ("SV-DEMO-001", "TOPUP", 200_000, "PAY-DEMO-001-B", "Nạp tiền đã đối soát", -6),
        ("SV-DEMO-001", "BOOKING_PAYMENT", -20_000, "DEMO-RB-001", "Thanh toán đặt phòng đã hoàn tất", -2),
        ("SV-DEMO-003", "TOPUP", 150_000, "PAY-DEMO-003-A", "Nạp tiền đã đối soát", -8),
        ("SV-DEMO-003", "BOOKING_PAYMENT", -30_000, "DEMO-RB-002", "Thanh toán đặt phòng đang sử dụng", -0.04),
        ("GV-DEMO-004", "TOPUP", 30_000, "PAY-DEMO-004-A", "Nạp tiền để thanh toán đặt phòng", -5),
        ("GV-DEMO-004", "BOOKING_PAYMENT", -30_000, "DEMO-RB-004", "Thanh toán trước khi hủy", -4),
        ("GV-DEMO-004", "REFUND", 30_000, "DEMO-RB-004", "Hoàn tiền lượt đặt đã hủy", -3),
        ("SV-DEMO-005", "TOPUP", 50_000, "PAY-DEMO-005-A", "Nạp tiền đã đối soát", -4),
        ("SV-DEMO-011", "TOPUP", 100_000, "PAY-DEMO-011-A", "Nạp tiền đã đối soát", -5),
        ("SV-DEMO-011", "FINE_PAYMENT", -50_000, "FINE-DEMO-PAID-011", "Thanh toán đủ khoản phạt mẫu", -0.5),
        ("SV-DEMO-009", "TOPUP", 50_000, "FT26_UNMATCHED_003", "Cộng ví sau khi gán giao dịch ngân hàng", -0.99),
    ]
    balances = {}
    for user_code, txn_type, amount, ref, description, day_offset in sorted(events, key=lambda event: event[-1]):
        if not db.query(User).filter_by(user_code=user_code).first():
            continue
        before = balances.get(user_code, 0)
        after = before + amount
        if after < 0:
            raise ValueError(f"Số dư demo âm: {user_code}, {ref}")
        txn = db.query(WalletTxn).filter_by(
            user_code=user_code, reference_id=ref, txn_type=txn_type
        ).one_or_none()
        if txn is None:
            txn = WalletTxn(user_code=user_code, reference_id=ref, txn_type=txn_type)
            db.add(txn)
        txn.amount = amount
        txn.balance_before = before
        txn.balance_after = after
        txn.description = description
        txn.created_at = now + timedelta(days=day_offset)
        balances[user_code] = after
    db.flush()
    for user_code, balance in balances.items():
        user = db.query(User).filter_by(user_code=user_code).one()
        user.service_balance = balance


def _seed_unmatched_tx(db, now):
    """Seed giao dịch ngân hàng chưa khớp (UC16 – UnmatchedTx)."""
    UNMATCHED_DEFS = [
        {
            "bank_tx_id": "FT26_UNMATCHED_001",
            "amount": 100_000,
            "bank_account_number": "0901234567",
            "transfer_content": "NGUYEN VAN DEMO NAP TIEN THU VIEN",
            "received_at": now - timedelta(days=3),
            "status": "UNRESOLVED",
            "resolved_by": None,
            "resolution_notes": None,
        },
        {
            "bank_tx_id": "FT26_UNMATCHED_002",
            "amount": 75_000,
            "bank_account_number": "0912345678",
            "transfer_content": "TRAN THI B THU VIEN TDTU",
            "received_at": now - timedelta(days=5),
            "status": "UNRESOLVED",
            "resolved_by": None,
            "resolution_notes": None,
        },
        {
            "bank_tx_id": "FT26_UNMATCHED_003",
            "amount": 50_000,
            "bank_account_number": "0923456789",
            "transfer_content": "NAP TIEN KHONG GHI MA PAY CODE DEMO",
            "received_at": now - timedelta(days=1),
            "status": "ASSIGNED",
            "resolved_by": "ADMIN-0001",
            "resolution_notes": "Đã đối soát, cộng số dư cho SV-DEMO-009",
        },
    ]

    for item in UNMATCHED_DEFS:
        row = db.query(UnmatchedTx).filter_by(bank_tx_id=item["bank_tx_id"]).one_or_none()
        if row is None:
            row = UnmatchedTx(bank_tx_id=item["bank_tx_id"])
            db.add(row)
        for key, value in item.items():
            setattr(row, key, value)
        row.created_at = item["received_at"] + timedelta(minutes=1)


def _seed_fine_payments(db, now):
    """Seed một khoản phạt đã thanh toán khớp với fine và ledger ví."""
    user_code = "SV-DEMO-011"
    loan = db.query(Loan).filter_by(user_code=user_code, checkout_condition="DEMO-PAID-FINE").one_or_none()
    if loan is None:
        book = db.query(Book).filter(Book.title.like("[DEMO-%")).order_by(Book.id).offset(7).first()
        copy = db.query(BookCopy).filter_by(book_id=book.id, status="AVAILABLE").first() if book else None
        if not book or not copy:
            return
        loan = Loan(
            user_code=user_code, book_id=book.id, copy_barcode=copy.copy_barcode,
            loan_type="PHYSICAL", loan_status="RETURNED",
            borrow_date=now - timedelta(days=25), due_date=now - timedelta(days=11),
            return_date=now - timedelta(days=1), checkout_condition="DEMO-PAID-FINE",
        )
        db.add(loan)
        db.flush()
    fine = db.query(Fine).filter_by(loan_id=loan.id).one_or_none()
    if fine is None:
        fine = Fine(loan_id=loan.id, user_code=user_code)
        db.add(fine)
    fine.overdue_days = 10
    fine.fine_rate = 5_000
    fine.total_amount = 50_000
    fine.payment_status = "PAID"
    fine.created_at = now - timedelta(days=1)
    payment = db.query(FinePayment).filter_by(notes="DEMO-FINE-PAID-011").one_or_none()
    if payment is None:
        payment = FinePayment(notes="DEMO-FINE-PAID-011")
        db.add(payment)
    payment.user_code = user_code
    payment.admin_collector_code = "ADMIN-0001"
    payment.amount_paid = 50_000
    payment.payment_method = "WALLET"
    payment.payment_date = now - timedelta(hours=12)
    db.query(User).filter_by(user_code=user_code).update(
        {User.total_fines: 0, User.is_borrowing_blocked: False}
    )


def _seed_demo_loans_and_waitlists(db, books, now):
    """Seed stable UC fixtures; every physical loan reserves one real copy."""
    if len(books) < 8:
        return

    def loan_for(user_code, book, loan_type, status, barcode, start, due, marker, returned=None):
        row = db.query(Loan).filter_by(user_code=user_code, book_id=book.id, loan_type=loan_type).filter(
            Loan.checkout_condition == marker
        ).one_or_none()
        if row is None:
            row = Loan(user_code=user_code, book_id=book.id, loan_type=loan_type)
            db.add(row)
        row.loan_status = status
        row.copy_barcode = barcode
        row.borrow_date = start
        row.due_date = due
        row.return_date = returned
        row.checkout_condition = marker
        row.renewal_count = 0
        return row

    def first_copy(book, status=None):
        query = db.query(BookCopy).filter_by(book_id=book.id)
        if status:
            query = query.filter_by(status=status)
        return query.order_by(BookCopy.copy_barcode).first()

    fixtures = [
        ("SV-DEMO-001", books[0], "BORROWED", "AVAILABLE", "DEMO-ACTIVE-LOAN"),
        ("SV-DEMO-003", books[1], "OVERDUE", "AVAILABLE", "DEMO-OVERDUE-LOAN"),
        ("SV-DEMO-005", books[2], "LOST", None, "DEMO-LOST-LOAN"),
    ]
    for user_code, book, loan_status, wanted_copy_status, marker in fixtures:
        existing = db.query(Loan).filter_by(user_code=user_code, book_id=book.id).filter(
            Loan.checkout_condition == marker
        ).one_or_none()
        copy = db.query(BookCopy).filter_by(copy_barcode=existing.copy_barcode).one_or_none() if existing and existing.copy_barcode else None
        if copy is None:
            copy = first_copy(book, wanted_copy_status)
        if copy is None:
            continue
        if loan_status == "LOST":
            copy.status = "RETIRED"
            copy.damage_notes = "Mất sách – fixture demo UC15"
        else:
            copy.status = "BORROWED"
        borrow_date = now - timedelta(days=10 if loan_status == "LOST" else (25 if loan_status == "OVERDUE" else 5))
        due_date = now + timedelta(days=4) if loan_status == "LOST" else (
            now - timedelta(days=11) if loan_status == "OVERDUE" else now + timedelta(days=9)
        )
        loan = loan_for(user_code, book, "PHYSICAL", loan_status, copy.copy_barcode,
                        borrow_date, due_date, marker)
        db.flush()
        if loan_status == "OVERDUE":
            fine = db.query(Fine).filter_by(loan_id=loan.id).one_or_none()
            if fine is None:
                fine = Fine(loan_id=loan.id, user_code=user_code)
                db.add(fine)
            fine.overdue_days = 11
            fine.fine_rate = 5_000
            fine.total_amount = 55_000
            fine.payment_status = "UNPAID"
            db.query(User).filter_by(user_code=user_code).update(
                {User.total_fines: 55_000, User.is_borrowing_blocked: True}
            )
        elif loan_status == "LOST":
            incident = db.query(Incident).filter_by(loan_id=loan.id).one_or_none()
            penalty = int(book.price or 150_000)
            if incident is None:
                incident = Incident(loan_id=loan.id, user_code=user_code)
                db.add(incident)
            incident.incident_type = "BOOK_LOST"
            incident.severity = "SEVERE"
            incident.penalty_amount = penalty
            incident.description = f"DEMO: báo mất {book.title}; bồi thường theo giá bìa"
            incident.status = "RESOLVED"
            db.query(User).filter_by(user_code=user_code).update(
                {User.total_fines: penalty, User.is_borrowing_blocked: True}
            )

    # EBook loan uses a book that has a matching Ebook row.
    ebook = db.query(Book).join(Ebook).filter(Book.title.like("[DEMO-%")).order_by(Book.id).first()
    if ebook:
        loan_for("GV-DEMO-002", ebook, "EBOOK", "BORROWED", None,
                 now - timedelta(days=3), now + timedelta(days=11), "DEMO-EBOOK-LOAN")
    # A REQUESTED loan is a hold request, so it has no copy and does not change stock.
    loan_for("SV-DEMO-007", books[4], "PHYSICAL", "REQUESTED", None,
             now - timedelta(hours=2), now + timedelta(hours=22), "DEMO-REQUESTED-LOAN")

    # Make the waitlisted title genuinely unavailable, with one borrowed loan per copy.
    waitlisted_book = books[5]
    for index, copy in enumerate(db.query(BookCopy).filter_by(book_id=waitlisted_book.id).order_by(BookCopy.copy_barcode).all(), start=11):
        if copy.status == "AVAILABLE":
            copy.status = "BORROWED"
        assigned_user = f"SV-DEMO-{index:03d}"
        if db.query(User).filter_by(user_code=assigned_user).first():
            loan_for(assigned_user, waitlisted_book, "PHYSICAL", "BORROWED", copy.copy_barcode,
                     now - timedelta(days=2), now + timedelta(days=12), f"DEMO-WAITLIST-FILL-{copy.copy_barcode}")

    # Another book remains available; HELD reserves one available copy logically.
    waiting_user = db.query(User).filter_by(user_code="SV-DEMO-009").first()
    held_user = db.query(User).filter_by(user_code="GV-DEMO-004").first()
    if waiting_user:
        row = db.query(Waitlist).filter_by(user_code=waiting_user.user_code, book_id=waitlisted_book.id).one_or_none()
        if row is None:
            row = Waitlist(user_code=waiting_user.user_code, book_id=waitlisted_book.id)
            db.add(row)
        row.queue_position = 1
        row.status = "WAITING"
        row.hold_expires_at = None
        row.created_at = now - timedelta(hours=4)
    if held_user:
        held_book = books[6]
        row = db.query(Waitlist).filter_by(user_code=held_user.user_code, book_id=held_book.id).one_or_none()
        if row is None:
            row = Waitlist(user_code=held_user.user_code, book_id=held_book.id)
            db.add(row)
        row.queue_position = 1
        row.status = "HELD"
        row.created_at = now - timedelta(hours=4)
        row.hold_expires_at = now + timedelta(hours=20)

    # Đảm bảo các thay đổi trạng thái BookCopy (BORROWED, RETIRED) được flush xuống
    # trước khi truy vấn đếm để available_stock khớp tuyệt đối ngay từ lần seed đầu tiên.
    db.flush()

    # Repair seeded stock from the copy states instead of incrementing blindly.
    for book in books:
        book.available_stock = db.query(BookCopy).filter_by(book_id=book.id, status="AVAILABLE").count()


# ────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    seed_database()

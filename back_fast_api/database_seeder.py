"""Seed repeatable development/demo data after applying Alembic migrations."""

import os
import random
from faker import Faker

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import Account, Book, BookCopy, Category, Ebook, Room, Subject, User


fake = Faker("vi_VN")
fake.seed_instance(20261016)
DEMO_PASSWORD = "User@123"
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin").strip()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin@123")

CATEGORIES = [
    "Công nghệ thông tin",
    "Khoa học",
    "Văn học",
    "Kinh tế",
    "Ngoại ngữ",
]
SUBJECTS = [
    ("IT", "Công nghệ thông tin", "Khoa Công nghệ thông tin"),
    ("MATH", "Toán học", "Khoa Khoa học cơ bản"),
    ("PHYS", "Vật lý", "Khoa Khoa học cơ bản"),
    ("ECON", "Kinh tế", "Khoa Kinh tế"),
    ("ENG", "Tiếng Anh", "Khoa Ngoại ngữ"),
]


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
    return user


def seed_database():
    """Insert missing demo rows without duplicating or resetting existing data.

    Run ``alembic upgrade head`` before invoking this script. The stable demo
    keys make this safe to run repeatedly and allow partially seeded databases
    to be completed on a later run.
    """
    if not ADMIN_USERNAME or not ADMIN_PASSWORD:
        raise ValueError("ADMIN_USERNAME và ADMIN_PASSWORD không được để trống")

    fake.seed_instance(20261016)
    rng = random.Random(20261016)
    db = SessionLocal()
    try:
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

        _seed_user(
            db,
            username=ADMIN_USERNAME,
            role="ADMIN",
            user_code="ADMIN-0001",
            name="Quản trị viên thư viện",
            email="admin@library.local",
            password=ADMIN_PASSWORD,
        )
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
                balance=[0, 50000, 150000, 300000][index % 4],
            )
        db.flush()

        for index in range(1, 101):
            title = f"[DEMO-{index:03d}] {fake.catch_phrase()}"
            book = _get_or_create(
                db,
                Book,
                {"title": title},
                author=fake.name(),
                publisher=fake.company(),
                publication_year=int(fake.year()),
                price=rng.randrange(5, 61) * 5000,
                description=fake.text(max_nb_chars=240),
                keywords=" ".join(fake.words(nb=4, unique=True)),
                num_pages=rng.randint(80, 800),
                book_type="BOTH" if index % 3 == 0 else ("EBOOK" if index % 3 == 1 else "PRINTED"),
                available_stock=0,
                category_id=categories[CATEGORIES[(index - 1) % len(CATEGORIES)]].id,
                subject_code=SUBJECTS[(index - 1) % len(SUBJECTS)][0],
            )
            # Repair any partially seeded demo row, while preserving inventory
            # changes made through the application after the first seed.
            book.price = book.price or rng.randrange(5, 61) * 5000
            book.subject_code = book.subject_code or SUBJECTS[(index - 1) % len(SUBJECTS)][0]

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

            if book.book_type in {"EBOOK", "BOTH"} and db.query(Ebook).filter_by(id=book.id).first() is None:
                db.add(
                    Ebook(
                        id=book.id,
                        file_path=f"demo/ebook-{index:03d}.pdf",
                        is_free=index % 5 == 0,
                    )
                )

        for index in range(1, 5):
            _get_or_create(
                db,
                Room,
                {"room_name": f"Phòng học nhóm {index:02d}"},
                capacity=4 + index * 2,
                room_type="STUDY",
                floor=str(index),
                is_active=True,
            )

        db.commit()
        print("Seed hoàn tất: 100 sách, 101 hồ sơ (gồm ADMIN), 4 phòng.")
        print(f"Tài khoản ADMIN: {ADMIN_USERNAME}; tài khoản mẫu: demo_student_001 / {DEMO_PASSWORD}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()

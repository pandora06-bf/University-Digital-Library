import random
from faker import Faker
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine
from app.models.base import Base
from app.models.user import Account, User
from app.models.book import Category, Subject, Book, BookCopy

import bcrypt
from faker import Faker

fake = Faker('vi_VN')

def get_password_hash(password):
    # Dùng trực tiếp thư viện bcrypt nguyên thủy thay vì thông qua passlib
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def seed_database():
    # Tự động tạo tất cả các bảng nếu chưa tồn tại
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # Seed Categories
        categories = ["Khoa học", "Văn học", "Lịch sử", "Toán học", "Công nghệ thông tin"]
        db_categories = []
        for name in categories:
            cat = db.query(Category).filter(Category.category_name == name).first()
            if not cat:
                cat = Category(category_name=name)
                db.add(cat)
            db_categories.append(cat)
        db.commit()

        # Seed Subjects
        subjects = ["IT", "MATH", "PHYS", "CHEM", "BIO"]
        db_subjects = []
        for code in subjects:
            subj = db.query(Subject).filter(Subject.subject_code == code).first()
            if not subj:
                subj = Subject(subject_code=code, subject_name=f"Môn {code}", department_name="Khoa Cơ bản")
                db.add(subj)
            db_subjects.append(subj)
        db.commit()

        # Seed 100 Users
        print("Seeding Users...")
        users = []
        for i in range(1, 101):
            role = random.choice(["STUDENT", "LECTURER"])
            # Account
            acc = Account(
                username=f"user_{i}_{fake.user_name()}",
                password=get_password_hash("123456"),
                role=role,
                is_active=True
            )
            db.add(acc)
            db.flush()

            user_code = f"SV{fake.random_int(min=10000, max=99999)}_{i}" if role == "STUDENT" else f"GV{fake.random_int(min=10000, max=99999)}_{i}"
            
            user = User(
                user_code=user_code,
                account_id=acc.id,
                full_name=fake.name(),
                email=f"email_{i}_{fake.email()}",
                phone_number=fake.phone_number()[:20],
                department=random.choice(["IT", "Kinh tế", "Ngoại ngữ"]),
                user_type=role,
                max_borrow_limit=5,
                max_borrow_days=14
            )
            db.add(user)
            users.append(user)
        db.commit()

        # Seed 100 Books
        print("Seeding Books...")
        for i in range(1, 101):
            cat = random.choice(db_categories)
            subj = random.choice(db_subjects)
            
            book = Book(
                title=f"{fake.catch_phrase()} - {i}",
                author=fake.name(),
                publisher=fake.company(),
                publication_year=int(fake.year()),
                description=fake.text(),
                keywords=fake.word(),
                num_pages=random.randint(100, 1000),
                book_type=random.choice(["PRINTED", "EBOOK", "BOTH"]),
                available_stock=random.randint(1, 10),
                category_id=cat.id,
                subject_code=subj.subject_code
            )
            db.add(book)
            db.flush()
            
            # Create Book Copies
            if book.book_type in ["PRINTED", "BOTH"]:
                for j in range(book.available_stock):
                    copy = BookCopy(
                        copy_barcode=f"BC-{book.id}-{j}-{fake.random_int(min=1000, max=9999)}",
                        book_id=book.id,
                        zone=random.choice(["A", "B", "C"]),
                        floor=random.choice(["1", "2", "3"]),
                        shelf=random.choice(["101", "102", "201", "202"]),
                        status="AVAILABLE"
                    )
                    db.add(copy)
        db.commit()
        print("Database seeded successfully with 100 users and 100 books!")
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()

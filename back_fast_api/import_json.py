# import json
# from datetime import datetime
# from decimal import Decimal
# import bcrypt
# from sqlalchemy import select

# from app.core.database import SessionLocal
# from app.models.user import Account, User


# def get_password_hash(password: str) -> str:
#     return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


# def seed_users_from_json(json_filepath: str = "back_fast_api/mocks/users_mock.json"):
#     db = SessionLocal()
#     default_password = "password123"
#     hashed_pw = get_password_hash(default_password)

#     try:
#         with open(json_filepath, "r", encoding="utf-8") as f:
#             user_list = json.load(f)

#         print(f"Bắt đầu nạp {len(user_list)} người dùng vào cơ sở dữ liệu...")

#         for item in user_list:
#             acc_id = item["account_id"]
#             user_code = item["user_code"]
#             role = item.get("user_type", "STUDENT").strip().upper()

#             # 1. Kiểm tra hoặc tạo Account trước
#             account = db.get(Account, acc_id)
#             if not account:
#                 username = item["email"].split("@")[0]
#                 existing_acc = db.scalar(
#                     select(Account).where(Account.username == username)
#                 )
#                 if existing_acc:
#                     username = user_code.lower()

#                 account = Account(
#                     id=acc_id,
#                     username=username,
#                     password=hashed_pw,
#                     role=role,
#                     is_active=True,
#                 )
#                 db.add(account)
#                 db.flush()

#             # 2. Kiểm tra hoặc nạp User
#             existing_user = db.get(User, user_code)
#             if not existing_user:
#                 updated_at_val = (
#                     datetime.fromisoformat(item["updated_at"].replace("Z", "+00:00"))
#                     if item.get("updated_at")
#                     else datetime.now()
#                 )

#                 new_user = User(
#                     user_code=user_code,
#                     account_id=account.id,
#                     full_name=item["full_name"],
#                     email=item["email"],
#                     phone_number=item.get("phone_number"),
#                     department=item["department"],
#                     academic_title=item.get("academic_title"),
#                     user_type=role,
#                     max_borrow_limit=item.get("max_borrow_limit", 3),
#                     max_borrow_days=item.get("max_borrow_days", 14),
#                     is_borrowing_blocked=item.get("is_borrowing_blocked", False),
#                     total_fines=Decimal(str(item.get("total_fines", "0.00"))),
#                     updated_at=updated_at_val,
#                 )
#                 db.add(new_user)

#         db.commit()
#         print("-> Đã nạp thành công toàn bộ User và sinh Account tương ứng!")
#         print(f"-> Mật khẩu mặc định để test login là: '{default_password}'")

#     except Exception as e:
#         db.rollback()
#         print(f"Lỗi khi nạp dữ liệu: {e}")
#     finally:
#         db.close()

import json
import os
from datetime import datetime
from app.core.database import SessionLocal
from app.models.book import Book, BookCopy, Category, Subject


def seed_books_from_json(json_filepath: str):
    db = SessionLocal()
    try:
        with open(json_filepath, "r", encoding="utf-8") as f:
            book_list = json.load(f)

        print(f"Bắt đầu nạp {len(book_list)} sách vào cơ sở dữ liệu...")

        # 1. Đảm bảo các Subject có sẵn để tránh lỗi khóa ngoại
        subjects_data = {
            "IT": ("Công nghệ thông tin", "Khoa CNTT"),
            "ECO": ("Kinh tế", "Khoa Quản trị Kinh doanh"),
            "ENG": ("Tiếng Anh", "Khoa Ngoại ngữ"),
        }
        for code, (name, dept) in subjects_data.items():
            subj = db.get(Subject, code)
            if not subj:
                db.add(Subject(subject_code=code, subject_name=name, department_name=dept))
        db.flush()

        # 2. Đảm bảo các Category có sẵn
        categories_data = {
            1: "Giáo trình - Công nghệ",
            2: "Báo cáo - Khóa luận",
            3: "Kinh tế - Xã hội",
            4: "Ngoại ngữ",
        }
        for cat_id, cat_name in categories_data.items():
            cat = db.get(Category, cat_id)
            if not cat:
                db.add(Category(id=cat_id, category_name=cat_name))
        db.flush()

        # 3. Nạp danh sách Sách và tạo bản sao (BookCopy)
        for item in book_list:
            book_id = item["id"]
            existing_book = db.get(Book, book_id)
            if not existing_book:
                created_at_val = (
                    datetime.fromisoformat(item["created_at"].replace("Z", "+00:00"))
                    if item.get("created_at")
                    else datetime.now()
                )

                new_book = Book(
                    id=book_id,
                    title=item["title"],
                    author=item["author"],
                    publisher=item["publisher"],
                    publication_year=item["publication_year"],
                    description=item.get("description"),
                    keywords=item.get("keywords"),
                    num_pages=item.get("num_pages"),
                    book_type=item.get("book_type", "PRINTED"),
                    available_stock=item.get("available_stock", 1),
                    category_id=item["category_id"],
                    subject_code=item["subject_code"],
                    created_at=created_at_val,
                )
                db.add(new_book)
                db.flush()

                # Tạo bản sao vật lý để sinh viên có thể mượn
                if new_book.book_type in ["PRINTED", "BOTH"]:
                    for j in range(1, new_book.available_stock + 1):
                        copy = BookCopy(
                            copy_barcode=f"BC-{new_book.id:04d}-{j:02d}",
                            book_id=new_book.id,
                            zone="A",
                            floor="1",
                            shelf="101",
                            status="AVAILABLE",
                        )
                        db.add(copy)

        db.commit()
        print("-> Đã nạp thành công toàn bộ Sách và sinh BookCopy tương ứng!")

    except Exception as e:
        db.rollback()
        print(f"Lỗi khi nạp sách: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    container_mock_path = "/data/mocks/books_mock.json"
    local_mock_path = "mocks/books_mock.json"

    target_path = (
        container_mock_path if os.path.exists(container_mock_path) else local_mock_path
    )
    seed_books_from_json(target_path)

# if __name__ == "__main__":
#     import os

#     # Ưu tiên đường dẫn mount trong Docker container: /data/mocks/users.json
#     container_mock_path = "/data/mocks/users.json"
#     local_mock_path = "mocks/users_mock.json"

#     target_path = (
#         container_mock_path if os.path.exists(container_mock_path) else local_mock_path
#     )
#     seed_users_from_json(target_path)
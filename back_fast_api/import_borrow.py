import json
import os
from datetime import datetime

from app.core.database import SessionLocal
from app.models.book import Book, BookCopy
from app.models.user import User

# Import model Loan (hỗ trợ các vị trí import thường gặp trong dự án)
try:
    from app.models.loan import Loan
except ImportError:
    try:
        from app.models.loan import Loan
    except ImportError:
        from app.models.book import Loan


def seed_loans_from_json(json_filepath: str):
    db = SessionLocal()
    try:
        with open(json_filepath, "r", encoding="utf-8") as f:
            loan_list = json.load(f)

        print(f"Bắt đầu nạp {len(loan_list)} giao dịch mượn - trả vào bảng loans...")

        for item in loan_list:
            loan_id = item["id"]
            existing_loan = db.get(Loan, loan_id)
            if existing_loan:
                continue

            student_code = item["student_code"]
            book_id = item["book_id"]
            copy_barcode = item.get("copy_barcode")

            # 1. Kiểm tra tồn tại của User và Book
            # Kiểm tra theo user_code nếu mô hình User dùng user_code làm PK
            user = db.get(User, student_code)
            book = db.get(Book, book_id)

            if not user:
                print(f"Bỏ qua Loan #{loan_id}: Không tìm thấy User với mã '{student_code}'")
                continue
            if not book:
                print(f"Bỏ qua Loan #{loan_id}: Không tìm thấy Book ID '{book_id}'")
                continue

            # 2. Xử lý thời gian
            borrow_date = (
                datetime.fromisoformat(item["borrow_date"].replace("Z", "+00:00"))
                if item.get("borrow_date")
                else datetime.now()
            )
            due_date = (
                datetime.fromisoformat(item["due_date"].replace("Z", "+00:00"))
                if item.get("due_date")
                else datetime.now()
            )
            return_date = (
                datetime.fromisoformat(item["return_date"].replace("Z", "+00:00"))
                if item.get("return_date")
                else None
            )

            # Lấy mã người mượn (chấp nhận cả key student_code hoặc user_code trong JSON)
            borrower_code = item.get("student_code") or item.get("user_code")

            user = db.get(User, borrower_code)
            book = db.get(Book, book_id)

            if not user:
                print(f"Bỏ qua Loan #{loan_id}: Không tìm thấy User '{borrower_code}'")
                continue
            if not book:
                print(f"Bỏ qua Loan #{loan_id}: Không tìm thấy Book ID '{book_id}'")
                continue

            # Khởi tạo Loan với user_code
            new_loan = Loan(
                id=loan_id,
                user_code=borrower_code,
                book_id=book_id,
                copy_barcode=copy_barcode,
                loan_type=item["loan_type"],
                loan_status=item["loan_status"],
                borrow_date=borrow_date,
                due_date=due_date,
                return_date=return_date,
                renewal_count=item.get("renewal_count", 0),
                checkout_condition=item.get("checkout_condition"),
                checkin_condition=item.get("checkin_condition"),
                ebook_access_token=item.get("ebook_access_token"),
            )
            db.add(new_loan)

            # 4. Nếu là mượn sách giấy, đồng bộ trạng thái của BookCopy
            if copy_barcode:
                copy = db.get(BookCopy, copy_barcode)
                if copy:
                    if item["loan_status"] in ["BORROWED", "OVERDUE"]:
                        copy.status = "BORROWED"
                    elif item["loan_status"] == "RETURNED":
                        copy.status = "AVAILABLE"

        db.commit()
        print("-> Đã nạp thành công toàn bộ giao dịch vào bảng loans!")

    except Exception as e:
        db.rollback()
        print(f"Lỗi khi nạp loans: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    container_mock_path = "/data/mocks/borrowings_mock.json"
    local_mock_path = "mocks/borrow_book.json"

    target_path = (
        container_mock_path if os.path.exists(container_mock_path) else local_mock_path
    )
    seed_loans_from_json(target_path)
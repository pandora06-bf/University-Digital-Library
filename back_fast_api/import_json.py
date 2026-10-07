import json
from datetime import datetime
from decimal import Decimal
import bcrypt
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.user import Account, User


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def seed_users_from_json(json_filepath: str = "back_fast_api/mocks/users_mock.json"):
    db = SessionLocal()
    default_password = "password123"
    hashed_pw = get_password_hash(default_password)

    try:
        with open(json_filepath, "r", encoding="utf-8") as f:
            user_list = json.load(f)

        print(f"Bắt đầu nạp {len(user_list)} người dùng vào cơ sở dữ liệu...")

        for item in user_list:
            acc_id = item["account_id"]
            user_code = item["user_code"]
            role = item.get("user_type", "STUDENT").strip().upper()

            # 1. Kiểm tra hoặc tạo Account trước
            account = db.get(Account, acc_id)
            if not account:
                username = item["email"].split("@")[0]
                existing_acc = db.scalar(
                    select(Account).where(Account.username == username)
                )
                if existing_acc:
                    username = user_code.lower()

                account = Account(
                    id=acc_id,
                    username=username,
                    password=hashed_pw,
                    role=role,
                    is_active=True,
                )
                db.add(account)
                db.flush()

            # 2. Kiểm tra hoặc nạp User
            existing_user = db.get(User, user_code)
            if not existing_user:
                updated_at_val = (
                    datetime.fromisoformat(item["updated_at"].replace("Z", "+00:00"))
                    if item.get("updated_at")
                    else datetime.now()
                )

                new_user = User(
                    user_code=user_code,
                    account_id=account.id,
                    full_name=item["full_name"],
                    email=item["email"],
                    phone_number=item.get("phone_number"),
                    department=item["department"],
                    academic_title=item.get("academic_title"),
                    user_type=role,
                    max_borrow_limit=item.get("max_borrow_limit", 3),
                    max_borrow_days=item.get("max_borrow_days", 14),
                    is_borrowing_blocked=item.get("is_borrowing_blocked", False),
                    total_fines=Decimal(str(item.get("total_fines", "0.00"))),
                    updated_at=updated_at_val,
                )
                db.add(new_user)

        db.commit()
        print("-> Đã nạp thành công toàn bộ User và sinh Account tương ứng!")
        print(f"-> Mật khẩu mặc định để test login là: '{default_password}'")

    except Exception as e:
        db.rollback()
        print(f"Lỗi khi nạp dữ liệu: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_users_from_json("back_fast_api/mocks/users_mock.json")
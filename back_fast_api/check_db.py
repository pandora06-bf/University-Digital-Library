from app.core.database import SessionLocal
from app.models.user import Account, User

db = SessionLocal()

try:
    accounts = db.query(Account).all()
    users = db.query(User).all()

    print(f"Tổng số Accounts: {len(accounts)}")
    for acc in accounts:
        print(f" - ID: {acc.id} | Username: {acc.username} | Role: {acc.role} | Active: {acc.is_active}")

    print(f"\nTổng số Users: {len(users)}")
    for u in users:
        print(f" - Code: {u.user_code} | Name: {u.full_name} | Email: {u.email} | AccID: {u.account_id}")

finally:
    db.close()
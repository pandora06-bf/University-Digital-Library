import argparse
import json
from getpass import getpass
from pathlib import Path
from decimal import Decimal

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import Account, User

ALLOWED_ROLES = {"STUDENT", "LECTURER", "ADMIN"}


def create_account(username: str, role: str) -> None:
    normalized_role = role.strip().upper()
    if normalized_role not in ALLOWED_ROLES:
        raise SystemExit(f"Role must be one of: {', '.join(sorted(ALLOWED_ROLES))}")

    password = getpass("Password (minimum 8 characters): ")
    confirmation = getpass("Confirm password: ")
    if len(password) < 8:
        raise SystemExit("Password must contain at least 8 characters")
    if password != confirmation:
        raise SystemExit("Passwords do not match")
    try:
        password_hash = hash_password(password)
    except ValueError as error:
        raise SystemExit(str(error)) from error

    with SessionLocal() as db:
        existing = db.scalar(select(Account).where(Account.username == username))
        if existing is not None:
            raise SystemExit("Username already exists")

        db.add(
            Account(
                username=username,
                password=password_hash,
                role=normalized_role,
                is_active=True,
            )
        )
        db.commit()

    print(f"Created {normalized_role} account: {username}")


def seed_mock_users(source: Path) -> None:
    if not source.is_file():
        raise SystemExit(f"Mock users file not found: {source}")

    try:
        users = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SystemExit(f"Could not read mock users: {error}") from error
    if not isinstance(users, list) or not users:
        raise SystemExit("Mock users file must contain a non-empty JSON array")

    password = getpass("Shared sample password (minimum 8 characters): ")
    confirmation = getpass("Confirm sample password: ")
    if len(password) < 8:
        raise SystemExit("Password must contain at least 8 characters")
    if password != confirmation:
        raise SystemExit("Passwords do not match")
    try:
        password_hash = hash_password(password)
    except ValueError as error:
        raise SystemExit(str(error)) from error

    with SessionLocal.begin() as db:
        for item in users:
            role = str(item.get("user_type", "STUDENT")).strip().upper()
            if role not in ALLOWED_ROLES:
                raise SystemExit(f"Unsupported role in mock data: {role}")

            email = str(item.get("email", "")).strip().lower()
            user_code = str(item.get("user_code", "")).strip()
            if not email or not user_code:
                raise SystemExit("Each mock user must have an email and user_code")

            account_exists = db.scalar(
                select(Account.id).where(Account.username == email)
            )
            user_exists = db.scalar(
                select(User.user_code).where(User.user_code == user_code)
            )
            if account_exists is not None or user_exists is not None:
                raise SystemExit(
                    f"Account or profile already exists for {email} ({user_code}); "
                    "no mock users were added"
                )

        for item in users:
            role = str(item.get("user_type", "STUDENT")).strip().upper()
            email = str(item["email"]).strip().lower()
            account = Account(username=email, password=password_hash, role=role)
            db.add(account)
            db.flush()

            db.add(
                User(
                    user_code=str(item["user_code"]).strip(),
                    account_id=account.id,
                    full_name=item["full_name"],
                    email=email,
                    phone_number=item.get("phone_number"),
                    department=item.get("department", ""),
                    academic_title=item.get("academic_title"),
                    user_type=role,
                    max_borrow_limit=item.get("max_borrow_limit", 3),
                    max_borrow_days=item.get("max_borrow_days", 14),
                    is_borrowing_blocked=item.get("is_borrowing_blocked", False),
                    total_fines=Decimal(str(item.get("total_fines", 0))),
                )
            )

    print(f"Seeded {len(users)} mock accounts and profiles from {source}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Manage LibManager accounts")
    subparsers = parser.add_subparsers(dest="command", required=True)
    create_parser = subparsers.add_parser("create-account")
    create_parser.add_argument("--username", required=True)
    create_parser.add_argument("--role", required=True, choices=sorted(ALLOWED_ROLES))
    seed_parser = subparsers.add_parser("seed-mock-users")
    seed_parser.add_argument(
        "--source",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "mocks" / "users_mock.json",
    )
    args = parser.parse_args()

    if args.command == "create-account":
        create_account(args.username.strip(), args.role)
    elif args.command == "seed-mock-users":
        seed_mock_users(args.source)


if __name__ == "__main__":
    main()

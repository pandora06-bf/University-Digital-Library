"""Validate Sprint 2C CSV fixtures independently of the not-yet-merged API."""

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HEADERS = [
    "username", "full_name", "email", "phone_number", "department",
    "user_type", "academic_title",
]
FILES = {
    "template": ROOT / "users_template.csv",
    "valid": ROOT / "tests" / "data" / "users_valid.csv",
    "errors": ROOT / "tests" / "data" / "users_with_errors.csv",
    "duplicates": ROOT / "tests" / "data" / "users_duplicate_username.csv",
}


def read_rows(path: Path) -> list[dict[str, str]]:
    if not path.is_file():
        raise ValueError(f"Missing fixture: {path}")
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != HEADERS:
            raise ValueError(f"{path.name}: expected headers {HEADERS}, got {reader.fieldnames}")
        return list(reader)


def validate() -> None:
    rows = {name: read_rows(path) for name, path in FILES.items()}
    valid = rows["valid"]
    for line, row in enumerate(valid, start=2):
        if not row["username"].strip() or not row["full_name"].strip():
            raise ValueError(f"users_valid.csv:{line}: username/full_name must be non-empty")
        if "@" not in row["email"]:
            raise ValueError(f"users_valid.csv:{line}: invalid email")
        if row["user_type"] not in {"STUDENT", "LECTURER"}:
            raise ValueError(f"users_valid.csv:{line}: invalid user_type {row['user_type']!r}")
    names = [row["username"].strip().casefold() for row in valid]
    emails = [row["email"].strip().casefold() for row in valid]
    if len(names) != len(set(names)) or len(emails) != len(set(emails)):
        raise ValueError("users_valid.csv contains duplicate username/email")

    error_rows = rows["errors"]
    has_expected_error = any(
        not row["username"].strip()
        or not row["email"].strip()
        or "@" not in row["email"]
        or row["user_type"] not in {"STUDENT", "LECTURER"}
        for row in error_rows
    )
    if not error_rows or not has_expected_error:
        raise ValueError("users_with_errors.csv must include malformed rows")
    if not any(
        row["username"].strip() and row["full_name"].strip()
        and "@" in row["email"] and row["user_type"] in {"STUDENT", "LECTURER"}
        for row in error_rows
    ):
        raise ValueError("users_with_errors.csv must also include a valid row")

    duplicate_rows = rows["duplicates"]
    duplicate_names = [row["username"].strip().casefold() for row in duplicate_rows if row["username"].strip()]
    if len(duplicate_names) == len(set(duplicate_names)):
        raise ValueError("users_duplicate_username.csv does not contain a duplicate username")
    if not any(
        row["username"].strip() and row["full_name"].strip()
        and "@" in row["email"] and row["user_type"] in {"STUDENT", "LECTURER"}
        for row in duplicate_rows
    ):
        raise ValueError("users_duplicate_username.csv must include a valid record")

    print("CSV fixture validation passed:")
    for name, data in rows.items():
        print(f"  {FILES[name].relative_to(ROOT)}: {len(data)} rows")
    print("CSV import API is not present in the current backend; API-level acceptance remains pending.")


if __name__ == "__main__":
    validate()

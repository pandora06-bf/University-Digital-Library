"""2B-08: Nhập hàng loạt tài khoản từ CSV/XLSX — parse_upload() và import_accounts()."""
import io

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.user import Account, User
from app.services import import_service as svc


def _csv_bytes(text: str) -> bytes:
    return text.encode("utf-8-sig")


HEADER = "username,user_code,full_name,email,department,role"


# ---------------------------------------------------------------- parse_upload (CSV)

def test_parse_csv_happy_path_skips_blank_rows():
    content = _csv_bytes(
        f"{HEADER}\n"
        "sv01,SV0001,Nguyen Van A,sv01@edu.vn,CNTT,STUDENT\n"
        ",,,,,\n"
        "sv02,SV0002,Tran Thi B,sv02@edu.vn,CNTT,STUDENT\n"
    )
    rows = svc.parse_upload(content, "users.csv")
    assert len(rows) == 2
    assert rows[0][0] == 2 and rows[0][1]["username"] == "sv01"
    assert rows[1][0] == 4 and rows[1][1]["username"] == "sv02"


def test_parse_csv_missing_required_column_raises():
    content = _csv_bytes("username,user_code,full_name,email,department\nsv01,SV1,A,a@b.vn,CNTT\n")
    with pytest.raises(ValueError):
        svc.parse_upload(content, "users.csv")


def test_parse_csv_duplicate_header_raises():
    content = _csv_bytes(f"{HEADER},role\nsv01,SV1,A,a@b.vn,CNTT,STUDENT,STUDENT\n")
    with pytest.raises(ValueError):
        svc.parse_upload(content, "users.csv")


def test_parse_unsupported_extension_raises():
    with pytest.raises(ValueError):
        svc.parse_upload(b"irrelevant", "users.txt")


# ---------------------------------------------------------------- parse_upload (XLSX)

def _xlsx_bytes(rows):
    openpyxl = pytest.importorskip("openpyxl")
    wb = openpyxl.Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_parse_xlsx_happy_path():
    header = ["username", "user_code", "full_name", "email", "department", "role"]
    data = _xlsx_bytes([header, ["sv03", "SV0003", "Le Van C", "sv03@edu.vn", "CNTT", "STUDENT"]])
    rows = svc.parse_upload(data, "users.xlsx")
    assert len(rows) == 1
    assert rows[0][1]["username"] == "sv03"


def test_parse_xlsx_missing_required_column_raises():
    header = ["username", "user_code", "full_name", "email", "department"]
    data = _xlsx_bytes([header, ["sv03", "SV0003", "Le Van C", "sv03@edu.vn", "CNTT"]])
    with pytest.raises(ValueError):
        svc.parse_upload(data, "users.xlsx")


# ---------------------------------------------------------------- import_accounts

def _row(number, **overrides):
    base = {"username": f"user{number}", "user_code": f"UC{number:04d}", "full_name": "Nguoi Dung Test",
            "email": f"user{number}@edu.vn", "department": "CNTT", "role": "STUDENT"}
    base.update(overrides)
    return (number, base)


def test_import_success_creates_account_and_user(db_session):
    result = svc.import_accounts(db_session, [_row(2)])
    db_session.commit()
    assert result["success_count"] == 1 and result["error_count"] == 0
    assert result["created_accounts"][0]["user_code"] == "UC0002"
    assert len(result["created_accounts"][0]["temporary_password"]) == 16
    assert db_session.query(Account).filter_by(username="user2").count() == 1
    assert db_session.get(User, "UC0002") is not None


def test_import_rejects_extra_column(db_session):
    number, row = _row(4)
    row[None] = ["cot du"]
    result = svc.import_accounts(db_session, [(number, row)])
    assert result["error_count"] == 1
    assert result["success_count"] == 0


def test_import_rejects_missing_field(db_session):
    number, row = _row(5)
    row["full_name"] = ""
    result = svc.import_accounts(db_session, [(number, row)])
    assert result["error_count"] == 1


def test_import_rejects_invalid_role(db_session):
    number, row = _row(6, role="SUPERADMIN")
    result = svc.import_accounts(db_session, [(number, row)])
    assert result["error_count"] == 1
    assert "Vai trò" in result["errors"][0]["reason"]


def test_import_rejects_invalid_email(db_session):
    number, row = _row(7, email="not-an-email")
    result = svc.import_accounts(db_session, [(number, row)])
    assert result["error_count"] == 1
    assert "Email" in result["errors"][0]["reason"]


def test_import_rejects_field_too_long(db_session):
    number, row = _row(8, full_name="A" * 101)
    result = svc.import_accounts(db_session, [(number, row)])
    assert result["error_count"] == 1
    assert "độ dài" in result["errors"][0]["reason"]


def test_import_rejects_invalid_username_chars(db_session):
    number, row = _row(9, username="user with space!")
    result = svc.import_accounts(db_session, [(number, row)])
    assert result["error_count"] == 1
    assert "Username" in result["errors"][0]["reason"]


def test_import_rejects_duplicate_username(db_session):
    n1, r1 = _row(10, username="dupuser")
    n2, r2 = _row(11, username="dupuser")
    result = svc.import_accounts(db_session, [(n1, r1), (n2, r2)])
    db_session.commit()
    assert result["success_count"] == 1 and result["error_count"] == 1
    assert "Trùng username" in result["errors"][0]["reason"]


def test_import_rejects_duplicate_user_code(db_session):
    n1, r1 = _row(12, user_code="DUPCODE")
    n2, r2 = _row(13, user_code="DUPCODE")
    result = svc.import_accounts(db_session, [(n1, r1), (n2, r2)])
    db_session.commit()
    assert result["success_count"] == 1 and result["error_count"] == 1
    assert "Trùng mã" in result["errors"][0]["reason"]


def test_import_rejects_duplicate_email(db_session):
    n1, r1 = _row(14, email="dup@edu.vn")
    n2, r2 = _row(15, email="dup@edu.vn")
    result = svc.import_accounts(db_session, [(n1, r1), (n2, r2)])
    db_session.commit()
    assert result["success_count"] == 1 and result["error_count"] == 1
    assert "Trùng email" in result["errors"][0]["reason"]


def test_import_integrity_error_reports_row(db_session, monkeypatch):
    def boom(*a, **kw):
        raise IntegrityError("stmt", {}, Exception("dup"))
    monkeypatch.setattr(db_session, "flush", boom)
    number, row = _row(16)
    result = svc.import_accounts(db_session, [(number, row)])
    assert result["error_count"] == 1
    assert "ràng buộc" in result["errors"][0]["reason"] or "khóa" in result["errors"][0]["reason"]


def test_import_unexpected_exception_reports_row(db_session, monkeypatch):
    def boom(password):
        raise RuntimeError("hash backend down")
    monkeypatch.setattr(svc, "hash_password", boom)
    number, row = _row(17)
    result = svc.import_accounts(db_session, [(number, row)])
    assert result["error_count"] == 1
    assert "RuntimeError" in result["errors"][0]["reason"]

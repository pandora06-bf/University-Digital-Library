"""2B-08: Nhập CSV/XLSX, kiểm tra từng hàng và báo lỗi theo hàng."""
import csv
import io
import re
import secrets
import string
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.security import hash_password
from app.models.user import Account, User

REQUIRED = ('username', 'user_code', 'full_name', 'email', 'department', 'role')
ROLES = {'STUDENT', 'LECTURER', 'LIBRARIAN', 'ADMIN'}

def _temporary_password():
    alphabet = string.ascii_letters + string.digits + '!@#$'
    return ''.join(secrets.choice(alphabet) for _ in range(16))

def parse_upload(data: bytes, filename: str):
    lower = filename.lower()
    if lower.endswith('.csv'):
        try:
            text = data.decode('utf-8-sig')
        except UnicodeDecodeError as exc:
            raise ValueError('CSV phải có mã hóa UTF-8') from exc
        reader = csv.DictReader(io.StringIO(text, newline=''))
        if not reader.fieldnames or len(set(reader.fieldnames)) != len(reader.fieldnames) or not all(x in reader.fieldnames for x in REQUIRED):
            raise ValueError('Thiếu cột bắt buộc: ' + ', '.join(REQUIRED))
        return [(n, row) for n, row in enumerate(reader, start=2) if any(str(v or '').strip() for v in row.values() if v is not None)]
    if lower.endswith('.xlsx'):
        try:
            from openpyxl import load_workbook
        except ImportError as exc:
            raise ValueError('Server thiếu thư viện openpyxl để đọc XLSX') from exc
        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        try:
            sheet = wb.active
            iterator = sheet.iter_rows(values_only=True)
            headers = [str(x).strip() if x is not None else '' for x in next(iterator, ())]
            if len(set(headers)) != len(headers) or not all(x in headers for x in REQUIRED):
                raise ValueError('Thiếu cột bắt buộc: ' + ', '.join(REQUIRED))
            return [(n, dict(zip(headers, vals))) for n, vals in enumerate(iterator, start=2) if any(str(v or '').strip() for v in vals)]
        finally:
            wb.close()
    raise ValueError('Chỉ hỗ trợ tệp .csv hoặc .xlsx')

def import_accounts(db: Session, rows):
    successes, errors, created = 0, [], []
    for number, raw in rows:
        row = {k: str(raw.get(k) or '').strip() for k in REQUIRED}
        try:
            if raw.get(None):
                raise ValueError('Dòng có nhiều cột hơn tiêu đề CSV')
            if any(not row[x] for x in REQUIRED):
                raise ValueError('Thiếu trường bắt buộc')
            if row['role'].upper() not in ROLES:
                raise ValueError('Vai trò không hợp lệ')
            if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', row['email']):
                raise ValueError('Email không hợp lệ')
            if len(row['username']) > 50 or len(row['user_code']) > 50 or len(row['full_name']) > 100 or len(row['email']) > 100 or len(row['department']) > 100:
                raise ValueError('Dữ liệu vượt độ dài cho phép')
            if not re.fullmatch(r'[A-Za-z0-9_.-]+', row['username']):
                raise ValueError('Username chỉ được chứa chữ Latin, số, dấu chấm, gạch dưới hoặc gạch ngang')
            if db.scalar(select(Account.id).where(Account.username == row['username'])):
                raise ValueError('Trùng username')
            if db.get(User, row['user_code']):
                raise ValueError('Trùng mã người dùng')
            if db.scalar(select(User.user_code).where(User.email == row['email'])):
                raise ValueError('Trùng email')
            password = _temporary_password()
            with db.begin_nested():
                account = Account(username=row['username'], password=hash_password(password), role=row['role'].upper(), is_active=True)
                db.add(account)
                db.flush()
                db.add(User(user_code=row['user_code'], account_id=account.id, full_name=row['full_name'],
                            email=row['email'], department=row['department'], user_type=row['role'].upper()))
                db.flush()
            successes += 1
            # Mật khẩu tạm chỉ xuất hiện một lần trong phản hồi HTTPS dành cho admin.
            created.append({'row': number, 'user_code': row['user_code'], 'username': row['username'], 'temporary_password': password})
        except ValueError as exc:
            errors.append({'row': number, 'reason': str(exc)})
        except IntegrityError:
            errors.append({'row': number, 'reason': 'Trùng khóa dữ liệu hoặc vi phạm ràng buộc'})
        except Exception as exc:
            errors.append({'row': number, 'reason': 'Không thể tạo tài khoản: ' + type(exc).__name__})
    return {'success_count': successes, 'error_count': len(errors), 'errors': errors, 'created_accounts': created}

"""POST /api/admin/users/import (2B-08)."""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import require_roles
from app.services.import_service import import_accounts, parse_upload
from app.services.email_notifier import send_temporary_password
from app.models.user import User, Account
from app.core.security import hash_password
from app.services.import_service import _temporary_password

router = APIRouter(prefix='/api/admin/users', tags=['Admin - User Import'])

@router.post('/import')
async def import_users(tasks: BackgroundTasks, file: UploadFile = File(...), db: Session = Depends(get_db), _=Depends(require_roles('ADMIN'))):
    if not file.filename or not file.filename.lower().endswith(('.csv', '.xlsx')):
        raise HTTPException(422, 'Chỉ hỗ trợ CSV/XLSX')
    data = await file.read(2_000_001)
    if len(data) > 2_000_000:
        raise HTTPException(413, 'Tệp quá lớn (tối đa 2 MB)')
    try:
        rows = parse_upload(data, file.filename)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    try:
        result = import_accounts(db, rows)
        contacts = [(db.get(User, x["user_code"]), x) for x in result["created_accounts"]]
        db.commit()
        for user, x in contacts:
            if user:
                tasks.add_task(send_temporary_password, user.email, user.full_name, x["username"], x["temporary_password"])
        return result
    except Exception:
        db.rollback()
        raise


@router.post('/{user_id}/reset-password')
def reset_password(user_id: int, tasks: BackgroundTasks, db: Session = Depends(get_db),
                   _=Depends(require_roles('ADMIN'))):
    from fastapi import HTTPException
    from sqlalchemy import select
    account = db.scalar(select(Account).where(Account.id == user_id).with_for_update())
    if not account:
        raise HTTPException(404, 'Tài khoản không tồn tại')
    temporary_password = _temporary_password()
    try:
        account.password = hash_password(temporary_password)
        db.flush()
        linked = db.scalar(select(User).where(User.account_id == account.id))
        db.commit()
    except Exception:
        db.rollback()
        raise
    if linked:
        tasks.add_task(send_temporary_password, linked.email, linked.full_name,
                       account.username, temporary_password)
    return {'user_id': user_id, 'message': 'Đã đặt lại mật khẩu; email sẽ được gửi nếu SMTP được cấu hình',
            'temporary_password': temporary_password}

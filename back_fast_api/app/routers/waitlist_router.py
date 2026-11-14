from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.loan import Waitlist
from app.models.user import User
from app.services.waitlist_logic import enqueue, lock_book, remove, promote_waitlist, HELD, ACTIVE

router = APIRouter(prefix="/api/waitlists", tags=["Waitlists"])

class WaitlistCreate(BaseModel):
    book_id: int = Field(gt=0)

def serialize(item, queue_size=None):
    # queue_size: số mục còn hiệu lực (WAITING/HELD) của cùng cuốn sách, để giao diện hiện "vị trí x/y" (3-13).
    return {"id": item.id, "book_id": item.book_id, "user_code": item.user_code,
            "queue_position": item.queue_position, "queue_size": queue_size, "status": item.status,
            "hold_expires_at": item.hold_expires_at, "created_at": item.created_at}


def queue_sizes(db: Session, book_ids):
    """Đếm hàng chờ còn hiệu lực theo từng book_id bằng một truy vấn."""
    if not book_ids:
        return {}
    rows = db.execute(select(Waitlist.book_id, func.count(Waitlist.id))
                      .where(Waitlist.book_id.in_(book_ids), Waitlist.status.in_(ACTIVE))
                      .group_by(Waitlist.book_id)).all()
    return {book_id: count for book_id, count in rows}

@router.post("", status_code=status.HTTP_201_CREATED)
def create_waitlist(data: WaitlistCreate, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    try:
        item = enqueue(db, data.book_id, user)
        # Người mới luôn xếp cuối hàng nên tổng hàng chờ bằng vị trí của họ.
        response = serialize(item, queue_size=item.queue_position)
        db.commit()
        return response
    except Exception:
        db.rollback()
        raise

@router.get("/my-waitlists")
def my_waitlists(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.scalars(select(Waitlist).where(Waitlist.user_code == user.user_code,
                       Waitlist.status.in_(ACTIVE)).order_by(Waitlist.created_at.desc())).all()
    sizes = queue_sizes(db, {item.book_id for item in items})
    return {"data": [serialize(item, sizes.get(item.book_id)) for item in items], "total": len(items)}

@router.delete("/{waitlist_id}")
def cancel_waitlist(waitlist_id: int, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    try:
        # Lock ordering always book -> waitlist, consistent with enqueue/promotion.
        book_id = db.scalar(select(Waitlist.book_id).where(Waitlist.id == waitlist_id,
                             Waitlist.user_code == user.user_code))
        if book_id is None:
            raise HTTPException(404, "Không tìm thấy mục đặt trước")
        lock_book(db, book_id)
        item = db.scalar(select(Waitlist).where(Waitlist.id == waitlist_id,
                     Waitlist.user_code == user.user_code, Waitlist.status.in_(ACTIVE)))
        if item is None:
            raise HTTPException(404, "Mục đặt trước không còn hiệu lực")
        was_held = item.status == HELD
        remove(db, item)
        if was_held:
            promote_waitlist(db, book_id)
        db.commit()
        return {"message": "Đã hủy đặt trước"}
    except Exception:
        db.rollback()
        raise

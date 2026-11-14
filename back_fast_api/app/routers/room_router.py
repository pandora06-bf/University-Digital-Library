"""2B-21: danh mục phòng và lịch trống."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.services import room_service as svc

router = APIRouter(tags=["Rooms"])


class RoomCreate(BaseModel):
    room_name: str = Field(..., min_length=1, max_length=100)
    capacity: int = Field(..., gt=0)
    price_per_slot: int = Field(..., gt=0)
    room_type: Optional[str] = Field(None, max_length=50)
    floor: Optional[str] = Field(None, max_length=100)
    is_active: bool = True


class RoomUpdate(BaseModel):
    room_name: Optional[str] = Field(None, min_length=1, max_length=100)
    capacity: Optional[int] = Field(None, gt=0)
    price_per_slot: Optional[int] = Field(None, gt=0)
    room_type: Optional[str] = Field(None, max_length=50)
    floor: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


@router.get("/api/rooms")
def list_rooms(db: Session = Depends(get_db)):
    rooms = svc.list_rooms(db)
    return {"data": [svc.room_data(r) for r in rooms], "total": len(rooms)}


@router.get(
    "/api/admin/rooms",
    dependencies=[Depends(require_roles("ADMIN", "LIBRARIAN"))],
)
def list_admin_rooms(db: Session = Depends(get_db)):
    rooms = svc.list_rooms(db, include_inactive=True)
    return {"data": [svc.room_data(room) for room in rooms], "total": len(rooms)}


@router.get("/api/rooms/{room_id}/availability")
def room_availability(room_id: int, date: date = Query(..., description="YYYY-MM-DD"),
                      db: Session = Depends(get_db)):
    return svc.availability(db, room_id, date)


@router.post("/api/admin/rooms", status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_roles("ADMIN", "LIBRARIAN"))])
def create_room(body: RoomCreate, db: Session = Depends(get_db)):
    try:
        room = svc.create_room(db, body.model_dump())
        data = svc.room_data(room)
        db.commit()
        return data
    except Exception:
        db.rollback()
        raise


@router.put("/api/admin/rooms/{room_id}",
            dependencies=[Depends(require_roles("ADMIN", "LIBRARIAN"))])
def update_room(room_id: int, body: RoomUpdate, db: Session = Depends(get_db)):
    try:
        room = svc.update_room(db, room_id, body.model_dump(exclude_unset=True, exclude_none=True))
        data = svc.room_data(room)
        db.commit()
        return data
    except Exception:
        db.rollback()
        raise

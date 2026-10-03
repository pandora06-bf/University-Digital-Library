from fastapi import APIRouter, Depends

from app.core.dependencies import require_roles
from app.models.user import Account

router = APIRouter(
    prefix="/api/users",
    tags=["Users"],
)


@router.get("")
def get_users(_admin: Account = Depends(require_roles("ADMIN"))):
    return {
        "message": "Get users API",
        "data": [],
    }

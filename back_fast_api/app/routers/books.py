from fastapi import APIRouter, Query

router = APIRouter(
    prefix="/api/books",
    tags=["Books"],
)


@router.get("")
def get_books(
    limit: int = Query(default=10, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
):
    return {
        "message": "Get books API",
        "limit": limit,
        "offset": offset,
        "data": [],
    }

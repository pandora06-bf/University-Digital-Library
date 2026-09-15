from fastapi import APIRouter

router = APIRouter(
    prefix="/api/loans",
    tags=["Loans"],
)


@router.get("")
def get_loans():
    return {
        "message": "Get loans API",
        "data": [],
    }

"""Trạng thái phiếu mượn còn hiệu lực — nguồn DUY NHẤT cho mọi chỗ kiểm tra hạn mức và mượn trùng.

Tính vào hạn mức mượn đồng thời (BR-01) và chặn mượn trùng:
- PENDING_PICKUP: đã đặt mượn trên web, chờ nhận tại quầy (giữ bản 24 giờ)
- REQUESTED: đăng ký giữ sách kiểu cũ, quầy vẫn xuất mượn được
- BORROWED, OVERDUE: đang giữ sách

Trước đây loan_service bỏ sót REQUESTED, còn waitlist_logic bỏ sót PENDING_PICKUP, nên sinh viên
có phiếu REQUESTED mượn được quá hạn mức (vd. 4/3) và mượn trùng đúng cuốn đang giữ.
"""

from fastapi import HTTPException

ACTIVE_LOAN_STATUSES = ("PENDING_PICKUP", "REQUESTED", "BORROWED", "OVERDUE")


def borrow_limit_error(active_loans: int, max_limit: int) -> HTTPException:
    """SRS UC04 E1 / UC05 E2 / UC07 E2: vượt hạn mức trả 403 kèm "đang mượn x/tối đa y"."""
    return HTTPException(
        status_code=403,
        detail=f"Đã đạt hạn mức mượn: đang mượn {active_loans}/tối đa {max_limit} cuốn",
    )

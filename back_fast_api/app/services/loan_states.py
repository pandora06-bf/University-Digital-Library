"""Trạng thái phiếu mượn còn hiệu lực — nguồn DUY NHẤT cho mọi chỗ kiểm tra hạn mức và mượn trùng.

Tính vào hạn mức mượn đồng thời (BR-01) và chặn mượn trùng:
- PENDING_PICKUP: đã đặt mượn trên web, chờ nhận tại quầy (giữ bản 24 giờ)
- REQUESTED: đăng ký giữ sách kiểu cũ, quầy vẫn xuất mượn được
- BORROWED, OVERDUE: đang giữ sách

Trước đây loan_service bỏ sót REQUESTED, còn waitlist_logic bỏ sót PENDING_PICKUP, nên sinh viên
có phiếu REQUESTED mượn được quá hạn mức (vd. 4/3) và mượn trùng đúng cuốn đang giữ.
"""

ACTIVE_LOAN_STATUSES = ("PENDING_PICKUP", "REQUESTED", "BORROWED", "OVERDUE")

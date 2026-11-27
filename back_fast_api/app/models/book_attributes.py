"""Thuộc tính sách theo SRS UC02: Giáo trình, Tài liệu tham khảo, Sách bài tập."""
import re

BOOK_ATTRIBUTES = {
    "TEXTBOOK": "Giáo trình",
    "REFERENCE": "Tài liệu tham khảo",
    "WORKBOOK": "Sách bài tập",
}

_WORKBOOK = re.compile(r"\b(in use|exercises?|workbook|practice|problems? and solutions)\b", re.I)
_TEXTBOOK = re.compile(r"\b(introduction|introductory|principles|fundamentals|essentials|edition|"
                       r"calculus|physics|chemistry|biology|economics|accounting|operating systems?|"
                       r"computer networks?|database systems?|algorithms?|textbook)\b", re.I)


def infer_book_attribute(title: str | None, description: str | None = None) -> str:
    """Gợi ý thuộc tính cho dữ liệu mẫu chưa khai báo: sách luyện tập → bài tập, sách nhập môn/giáo khoa
    → giáo trình, còn lại → tài liệu tham khảo. Thủ thư sửa lại được qua API quản trị."""
    text = f"{title or ''} {description or ''}"
    if _WORKBOOK.search(title or ""):
        return "WORKBOOK"
    if _TEXTBOOK.search(text):
        return "TEXTBOOK"
    return "REFERENCE"

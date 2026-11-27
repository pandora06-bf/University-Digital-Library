"""Kho lưu PDF eBook trên Cloudflare R2 (API tương thích S3).

Bật bằng biến môi trường:
    STORAGE_BACKEND=r2
    R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
    R2_ACCESS_KEY_ID=...   R2_SECRET_ACCESS_KEY=...   R2_BUCKET=...

Không đặt (hoặc STORAGE_BACKEND=local) thì mọi thứ chạy như cũ: PDF nằm trong private_storage/ebooks.

Bucket phải để RIÊNG TƯ. Backend đọc file rồi tự trả cho người dùng qua /api/ebooks/{id}/stream
sau khi kiểm tra read_token, nên trình duyệt không bao giờ thấy địa chỉ R2 hay link có chữ ký.
"""
import os
import re
from functools import lru_cache

from fastapi import HTTPException

R2_EBOOK_PREFIX = "r2:ebooks/"
_SAFE_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,200}\.pdf$")


def _env(name: str) -> str:
    return (os.getenv(name) or "").strip().strip('"').strip("'")


def r2_enabled() -> bool:
    return _env("STORAGE_BACKEND").lower() == "r2"


def bucket_name() -> str:
    name = _env("R2_BUCKET")
    if not name:
        raise RuntimeError("Thiếu R2_BUCKET trong cấu hình")
    return name


@lru_cache(maxsize=1)
def _client():
    import boto3
    from botocore.config import Config

    missing = [n for n in ("R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET") if not _env(n)]
    if missing:
        raise RuntimeError("Thiếu cấu hình R2: " + ", ".join(missing))
    return boto3.client(
        "s3",
        endpoint_url=_env("R2_ENDPOINT"),
        region_name="auto",
        aws_access_key_id=_env("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=_env("R2_SECRET_ACCESS_KEY"),
        config=Config(signature_version="s3v4", retries={"max_attempts": 3, "mode": "standard"},
                      connect_timeout=10, read_timeout=60),
    )


def ebook_key(file_path: str) -> str:
    """'r2:ebooks/<tên>.pdf' → khóa object 'ebooks/<tên>.pdf'. Chặn mọi đường dẫn lạ (../, thư mục con)."""
    if not isinstance(file_path, str) or not file_path.startswith(R2_EBOOK_PREFIX):
        raise HTTPException(status_code=404, detail="Không tìm thấy PDF")
    name = file_path.removeprefix(R2_EBOOK_PREFIX)
    if not _SAFE_NAME.match(name):
        raise HTTPException(status_code=404, detail="Không tìm thấy PDF")
    return f"ebooks/{name}"


def put_pdf(name: str, data: bytes) -> str:
    """Tải PDF lên bucket; trả về đường dẫn lưu trong DB ('r2:ebooks/<tên>')."""
    if not _SAFE_NAME.match(name):
        raise ValueError(f"Tên tệp PDF không hợp lệ: {name!r}")
    _client().put_object(Bucket=bucket_name(), Key=f"ebooks/{name}", Body=data,
                         ContentType="application/pdf")
    return R2_EBOOK_PREFIX + name


def get_pdf(file_path: str) -> bytes:
    key = ebook_key(file_path)
    try:
        obj = _client().get_object(Bucket=bucket_name(), Key=key)
    except Exception as exc:  # botocore ClientError (NoSuchKey/AccessDenied) hoặc lỗi mạng
        code = getattr(exc, "response", {}).get("Error", {}).get("Code", "")
        if code in ("NoSuchKey", "404", "NotFound"):
            raise HTTPException(status_code=404, detail="Không tìm thấy PDF") from exc
        raise HTTPException(status_code=503, detail="Kho lưu trữ eBook tạm thời không phản hồi") from exc
    return obj["Body"].read()


def object_size(name: str):
    """Kích thước object 'ebooks/<name>' hoặc None nếu chưa có (dùng cho script chuyển dữ liệu)."""
    try:
        return int(_client().head_object(Bucket=bucket_name(), Key=f"ebooks/{name}")["ContentLength"])
    except Exception:
        return None


def delete_pdf(file_path: str) -> None:
    try:
        _client().delete_object(Bucket=bucket_name(), Key=ebook_key(file_path))
    except Exception:
        # Không làm hỏng giao dịch DB chỉ vì không xóa được tệp cũ trên cloud.
        pass

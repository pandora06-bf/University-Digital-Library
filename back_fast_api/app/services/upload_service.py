from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status


BACKEND_ROOT = Path(__file__).resolve().parents[2]
STATIC_ROOT = BACKEND_ROOT / "static"
COVERS_DIR = STATIC_ROOT / "covers"
EBOOKS_DIR = BACKEND_ROOT / "private_storage" / "ebooks"

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_IMAGE_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024

ALLOWED_PDF_EXTENSIONS = {".pdf"}
ALLOWED_PDF_CONTENT_TYPES = {"application/pdf"}
MAX_PDF_SIZE = 20 * 1024 * 1024

for directory in (COVERS_DIR, EBOOKS_DIR):
    directory.mkdir(parents=True, exist_ok=True)


async def _read_upload(file: UploadFile, max_size: int) -> bytes:
    data = await file.read(max_size + 1)
    await file.close()

    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tệp tải lên không được để trống",
        )
    if len(data) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Tệp tải lên vượt quá dung lượng cho phép",
        )
    return data


def _build_filename(original_name: str | None, allowed_extensions: set[str]) -> tuple[str, str]:
    suffix = Path(original_name or "").suffix.lower()
    if suffix not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Định dạng tệp không hợp lệ. Chỉ chấp nhận: {', '.join(sorted(allowed_extensions))}",
        )
    return f"{uuid4().hex}{suffix}", suffix


async def save_cover_image(file: UploadFile) -> str:
    filename, _ = _build_filename(file.filename, ALLOWED_IMAGE_EXTENSIONS)
    if file.content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ảnh bìa phải là JPG, PNG hoặc WEBP",
        )

    data = await _read_upload(file, MAX_IMAGE_SIZE)
    target = COVERS_DIR / filename
    target.write_bytes(data)
    return f"/static/covers/{filename}"


async def save_ebook_pdf(file: UploadFile) -> str:
    filename, _ = _build_filename(file.filename, ALLOWED_PDF_EXTENSIONS)
    if file.content_type not in ALLOWED_PDF_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tệp eBook phải có định dạng PDF",
        )

    data = await _read_upload(file, MAX_PDF_SIZE)
    if not data.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nội dung tệp không phải PDF hợp lệ",
        )

    # A PDF extension and declared MIME alone cannot prove its actual type.
    try:
        from pypdf import PdfReader
        from io import BytesIO
        PdfReader(BytesIO(data), strict=True).pages[0]
    except Exception as exc:
        raise HTTPException(status_code=400, detail="PDF bị hỏng hoặc không hợp lệ") from exc
    target = EBOOKS_DIR / filename
    target.write_bytes(data)
    return f"private:ebooks/{filename}"


def delete_static_file(file_path: str | None) -> None:
    if not file_path:
        return
    if file_path.startswith("/static/covers/"):
        target = (STATIC_ROOT / file_path.removeprefix("/static/")).resolve()
        static_root = STATIC_ROOT.resolve()
    elif file_path.startswith("private:ebooks/"):
        target = (EBOOKS_DIR / file_path.removeprefix("private:ebooks/")).resolve()
        static_root = EBOOKS_DIR.resolve()
    else:
        return

    if static_root not in target.parents:
        return

    try:
        target.unlink(missing_ok=True)
    except OSError:
        # Không làm hỏng giao dịch DB chỉ vì tệp cũ không thể xóa.
        pass


def resolve_private_pdf(file_path: str) -> Path:
    """Never interpret an arbitrary DB path as a filesystem path."""
    if not file_path.startswith("private:ebooks/"):
        raise HTTPException(status_code=404, detail="PDF cũ phải được chuyển sang kho riêng")
    target = (EBOOKS_DIR / file_path.removeprefix("private:ebooks/")).resolve()
    if target.parent != EBOOKS_DIR.resolve() or not target.is_file():
        raise HTTPException(status_code=404, detail="Không tìm thấy PDF")
    return target

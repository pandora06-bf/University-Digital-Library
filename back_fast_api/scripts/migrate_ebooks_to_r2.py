"""Chuyển PDF eBook từ private_storage/ebooks lên Cloudflare R2 và cập nhật ebooks.file_path.

Chạy trong container api (đã đặt STORAGE_BACKEND=r2 và các biến R2_* trong .env):
    docker exec -w /app libmanager_api python -m scripts.migrate_ebooks_to_r2 --dry-run   # chỉ xem sẽ làm gì
    docker exec -w /app libmanager_api python -m scripts.migrate_ebooks_to_r2             # chuyển thật
    docker exec -w /app libmanager_api python -m scripts.migrate_ebooks_to_r2 --revert    # quay về đọc từ đĩa

- Chạy lại nhiều lần an toàn: file đã có trên R2 với đúng kích thước thì bỏ qua, không tải lại.
- Không xóa file trên đĩa, nên --revert luôn quay lại được.
- Kiểm tra kích thước sau khi tải; có lỗi thì không đổi đường dẫn nào trong DB (rollback).
"""
import argparse
import sys

from app.core.database import SessionLocal
from app.models.book import Ebook
from app.services import object_storage
from app.services.upload_service import EBOOKS_DIR, resolve_private_pdf

LOCAL_PREFIX = "private:ebooks/"


def migrate(dry_run: bool = False, session_factory=SessionLocal, out=print) -> dict:
    db = session_factory()
    stats = {"uploaded": 0, "skipped_existing": 0, "updated_rows": 0, "already_r2": 0, "missing_local": 0}
    try:
        rows = db.query(Ebook).order_by(Ebook.id).all()
        for ebook in rows:
            path = ebook.file_path or ""
            if path.startswith(object_storage.R2_EBOOK_PREFIX):
                stats["already_r2"] += 1
                continue
            try:
                local = resolve_private_pdf(path)  # chặn đường dẫn lạ, hỗ trợ cả dạng seed cũ demo/ebook-NNN.pdf
            except Exception:
                stats["missing_local"] += 1
                out(f"  ! eBook {ebook.id}: không tìm thấy file trên đĩa ({path})")
                continue
            size = local.stat().st_size
            if dry_run:
                out(f"  - eBook {ebook.id}: {local.name} ({size / 1_048_576:.1f} MB) → r2:ebooks/{local.name}")
                stats["updated_rows"] += 1
                continue
            if object_storage.object_size(local.name) == size:
                stats["skipped_existing"] += 1
            else:
                object_storage.put_pdf(local.name, local.read_bytes())
                if object_storage.object_size(local.name) != size:
                    raise RuntimeError(f"Kích thước trên R2 không khớp cho {local.name}")
                stats["uploaded"] += 1
            ebook.file_path = object_storage.R2_EBOOK_PREFIX + local.name
            stats["updated_rows"] += 1
        if not dry_run:  # chạy thử không đổi gì nên không cần commit hay rollback
            db.commit()
        return stats
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def revert(session_factory=SessionLocal, out=print) -> dict:
    """Đưa ebooks.file_path về 'private:ebooks/…' nếu file vẫn còn trên đĩa."""
    db = session_factory()
    stats = {"reverted": 0, "missing_local": 0}
    try:
        for ebook in db.query(Ebook).filter(Ebook.file_path.like(object_storage.R2_EBOOK_PREFIX + "%")).all():
            name = ebook.file_path.removeprefix(object_storage.R2_EBOOK_PREFIX)
            if (EBOOKS_DIR / name).is_file():
                ebook.file_path = LOCAL_PREFIX + name
                stats["reverted"] += 1
            else:
                stats["missing_local"] += 1
                out(f"  ! eBook {ebook.id}: không còn file {name} trên đĩa, giữ đường dẫn R2")
        db.commit()
        return stats
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Chuyển PDF eBook lên Cloudflare R2")
    parser.add_argument("--dry-run", action="store_true", help="chỉ liệt kê, không tải lên, không đổi DB")
    parser.add_argument("--revert", action="store_true", help="đổi đường dẫn về đĩa (private:ebooks/)")
    args = parser.parse_args(argv)
    if args.revert:
        print("Kết quả:", revert())
        return 0
    if not args.dry_run and not object_storage.r2_enabled():
        print("STORAGE_BACKEND chưa là 'r2' trong môi trường của container api. Dừng lại.", file=sys.stderr)
        return 2
    print("Kết quả:", migrate(dry_run=args.dry_run))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

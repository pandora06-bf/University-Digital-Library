"""One-time post-deploy migration for pre-existing public PDF files."""
from pathlib import Path
from shutil import copy2
from uuid import uuid4
from app.core.database import SessionLocal
from app.models.book import Ebook
from app.services.upload_service import EBOOKS_DIR, STATIC_ROOT

def migrate():
    db = SessionLocal()
    old_files = []
    try:
        for ebook in db.query(Ebook).filter(Ebook.file_path.like("/static/ebooks/%")).all():
            name = Path(ebook.file_path).name
            source = (STATIC_ROOT / "ebooks" / name).resolve()
            if source.parent != (STATIC_ROOT / "ebooks").resolve() or not source.is_file():
                raise RuntimeError(f"Missing old PDF: {ebook.id}")
            destination = EBOOKS_DIR / (uuid4().hex + ".pdf")
            copy2(source, destination)
            ebook.file_path = f"private:ebooks/{destination.name}"
            old_files.append(source)
        db.commit()
        for old in old_files:
            old.unlink()
        print(f"Migrated {len(old_files)} PDFs")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    migrate()

"""SRS UC02: books.alternative_title, books.book_attribute, books.num_chapters.

book_attribute của sách đã có được gợi ý từ tiêu đề (app/models/book_attributes.py); thủ thư sửa lại được.

Revision ID: n2711srs01
Revises: n2211admin01
"""
from alembic import op
import sqlalchemy as sa

revision = "n2711srs01"
down_revision = "n2211admin01"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    cols = {c["name"] for c in sa.inspect(bind).get_columns("books")}
    if "alternative_title" not in cols:
        op.add_column("books", sa.Column("alternative_title", sa.String(255), nullable=True))
    if "book_attribute" not in cols:
        op.add_column("books", sa.Column("book_attribute", sa.String(20), nullable=True))
        op.create_index("ix_books_book_attribute", "books", ["book_attribute"])
    if "num_chapters" not in cols:
        op.add_column("books", sa.Column("num_chapters", sa.Integer(), nullable=True))
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE books ADD CONSTRAINT chk_book_attribute_valid "
                   "CHECK (book_attribute IS NULL OR book_attribute IN ('TEXTBOOK','REFERENCE','WORKBOOK'))")
        op.execute("ALTER TABLE books ADD CONSTRAINT chk_book_num_chapters_positive "
                   "CHECK (num_chapters IS NULL OR num_chapters >= 1)")

    from app.models.book_attributes import infer_book_attribute
    books = sa.table("books", sa.column("id", sa.Integer), sa.column("title", sa.String),
                     sa.column("description", sa.Text), sa.column("book_attribute", sa.String))
    for row in bind.execute(sa.select(books.c.id, books.c.title, books.c.description)
                            .where(books.c.book_attribute.is_(None))).all():
        bind.execute(books.update().where(books.c.id == row.id)
                     .values(book_attribute=infer_book_attribute(row.title, row.description)))


def downgrade():
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE books DROP CONSTRAINT IF EXISTS chk_book_num_chapters_positive")
        op.execute("ALTER TABLE books DROP CONSTRAINT IF EXISTS chk_book_attribute_valid")
    cols = {c["name"] for c in sa.inspect(bind).get_columns("books")}
    if "num_chapters" in cols:
        op.drop_column("books", "num_chapters")
    if "book_attribute" in cols:
        op.drop_index("ix_books_book_attribute", table_name="books")
        op.drop_column("books", "book_attribute")
    if "alternative_title" in cols:
        op.drop_column("books", "alternative_title")

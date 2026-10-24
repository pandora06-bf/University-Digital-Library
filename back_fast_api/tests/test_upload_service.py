import asyncio
from io import BytesIO
import pytest
from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers
from app.services.upload_service import save_ebook_pdf, MAX_PDF_SIZE, resolve_private_pdf
from pypdf import PdfWriter

def pdf_bytes():
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    data = BytesIO()
    writer.write(data)
    return data.getvalue()

def test_valid_pdf_private():
    data = pdf_bytes()
    saved = asyncio.run(save_ebook_pdf(UploadFile(filename="valid.pdf", file=BytesIO(data), headers=Headers({"content-type":"application/pdf"}))))
    assert saved.startswith("private:ebooks/")
    assert resolve_private_pdf(saved).read_bytes() == data
    resolve_private_pdf(saved).unlink()

@pytest.mark.parametrize("name,content", [("hack.txt", b"%PDF-1.4"), ("bad.pdf", b"not pdf"), ("fake.pdf", b"%PDF-1.4\ninvalid")])
def test_invalid_pdf(name, content):
    with pytest.raises(HTTPException):
        asyncio.run(save_ebook_pdf(UploadFile(filename=name, file=BytesIO(content), headers=Headers({"content-type":"application/pdf"}))))

def test_size_limit():
    with pytest.raises(HTTPException) as exc:
        asyncio.run(save_ebook_pdf(UploadFile(filename="big.pdf", file=BytesIO(b"%PDF-" + b"0"*MAX_PDF_SIZE), headers=Headers({"content-type":"application/pdf"}))))
    assert exc.value.status_code == 413

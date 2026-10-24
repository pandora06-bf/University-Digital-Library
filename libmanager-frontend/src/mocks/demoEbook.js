// PDF mẫu tự tạo trong bộ nhớ, không chứa nội dung sách bản quyền.
// Phiên xem trước chỉ nhận PDF đã cắt còn 5 trang, không nhận tài liệu đầy đủ.
export function createDemoPdf(pageCount = 12) {
  const objects = [];
  const add = (value) => { objects.push(value); return objects.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pages = [];
  for (let page = 1; page <= pageCount; page++) {
    const content = `BT /F1 25 Tf 60 740 Td (LIBMANAGER - EBOOK DEMO) Tj 0 -50 Td /F1 16 Tf (Page ${page}) Tj 0 -55 Td /F1 12 Tf (This is an original sample document for the library reader.) Tj 0 -25 Td (Borrow the eBook to continue reading the complete sample.) Tj 0 -25 Td (No copyrighted book content is included in this demo.) Tj 0 -60 Td (Chapter ${page}: Learning and sharing knowledge) Tj 0 -30 Td (A digital library helps students discover reliable resources.) Tj 0 -25 Td (Study together, explore new ideas, and respect authors.) Tj ET`;
    const stream = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    pages.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${stream} 0 R >>`));
  }
  objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((id) => `${id} 0 R`).join(' ')}] >>`;
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

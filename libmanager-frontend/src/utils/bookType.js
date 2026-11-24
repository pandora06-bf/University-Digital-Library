/** Chuẩn hóa / nhãn định dạng sách — tách khỏi BookTypeBadge để ESLint fast-refresh. */

const LABELS = {
  BOTH: 'Cả hai',
  EBOOK: 'eBook',
  PRINTED: 'Vật lý',
};

export function normalizeBookType(type) {
  const t = String(type || '').trim().toUpperCase();
  if (t === 'BOTH' || t === 'CẢ HAI') return 'BOTH';
  if (t === 'EBOOK') return 'EBOOK';
  if (t === 'PRINTED' || t === 'VẬT LÝ' || t === 'PHYSICAL') return 'PRINTED';
  return 'PRINTED';
}

export function bookTypeLabelVi(type) {
  return LABELS[normalizeBookType(type)] || 'Vật lý';
}

export { LABELS as BOOK_TYPE_LABELS };

/** Badge định dạng sách — cùng màu Catalog / eBook / tồn kho. */

const STYLES = {
  BOTH: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  EBOOK: 'bg-purple-100 text-purple-700 border-purple-200',
  PRINTED: 'bg-slate-100 text-slate-600 border-slate-200',
};

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

export function BookTypeBadge({ type, className = '' }) {
  const key = normalizeBookType(type);
  return (
    <span
      className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${STYLES[key]} ${className}`}
    >
      {LABELS[key]}
    </span>
  );
}

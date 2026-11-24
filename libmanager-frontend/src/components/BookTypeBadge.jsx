/** Badge định dạng sách — cùng màu Catalog / eBook / tồn kho. */

import { BOOK_TYPE_LABELS, normalizeBookType } from '../utils/bookType';

const STYLES = {
  BOTH: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  EBOOK: 'bg-purple-100 text-purple-700 border-purple-200',
  PRINTED: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function BookTypeBadge({ type, className = '' }) {
  const key = normalizeBookType(type);
  return (
    <span
      className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${STYLES[key]} ${className}`}
    >
      {BOOK_TYPE_LABELS[key]}
    </span>
  );
}

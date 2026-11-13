/** Ghép URL ảnh/file tĩnh từ API (vd. /static/covers/…) với host backend. */
export function resolveMediaUrl(path) {
  if (!path) return null;
  const value = String(path).trim();
  if (!value) return null;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;

  const base = (import.meta.env.VITE_API_URL || 'http://localhost:8010').replace(/\/$/, '');
  if (value.startsWith('/')) return `${base}${value}`;
  return `${base}/${value}`;
}

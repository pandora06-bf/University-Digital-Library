export function accessDeadline(session) {
  if (session.access === 'locked') return 0;
  const deadlines = [session.expiresAt, session.loanExpiresAt].filter(Boolean).map((value) => new Date(value).getTime());
  if (deadlines.some((value) => !Number.isFinite(value))) return 0;
  if (session.access === 'borrowed' && (!session.readToken || deadlines.length === 0)) return 0;
  return deadlines.length ? Math.min(...deadlines) : Infinity;
}

export function previewLimit(value) {
  return Math.max(5, Math.min(10, Math.floor(Number(value) || 5)));
}

export function isForbidden(error) {
  return [401, 403].includes(Number(error?.status ?? error?.response?.status));
}

export function libraryTimestamp(value) {
  if (typeof value !== 'string') return value;
  // Backend hiện tại dùng TIMESTAMP không timezone; thời gian nghiệp vụ là UTC+7.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)) return `${value}+07:00`;
  return value;
}

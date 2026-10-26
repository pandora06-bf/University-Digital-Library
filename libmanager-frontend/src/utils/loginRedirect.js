// Đường dẫn đăng nhập kèm trang cần quay lại (2B-13, 2B-14)
export function loginPathFor(location) {
  return `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`;
}

// Chỉ nhận đường dẫn nội bộ ("/books/1"); chặn "//evil.com", "https://..." để tránh open redirect.
export function safeRedirect(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  if (value.startsWith('/login')) return null;
  return value;
}

// Trang sau đăng nhập: quay lại trang cũ nếu hợp lệ với vai trò, nếu không thì về trang mặc định.
export function landingPathFor(user, redirect) {
  const target = safeRedirect(redirect);
  if (user?.role === 'admin') return target?.startsWith('/admin') ? target : '/admin';
  return target && !target.startsWith('/admin') ? target : '/';
}

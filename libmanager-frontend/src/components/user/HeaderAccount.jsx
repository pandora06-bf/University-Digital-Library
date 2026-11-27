import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { profileService } from '../../services/profileService';

const ROLE_FALLBACK = { STUDENT: 'Sinh viên', LECTURER: 'Giảng viên', ADMIN: 'Thủ thư', LIBRARIAN: 'Thủ thư' };

// "Cô Kim Dương" → "KD"; một chữ → chữ cái đầu; không có tên → 2 ký tự đầu của tên đăng nhập.
function initialsOf(fullName, fallback = '') {
  const words = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words.at(-2)[0] + words.at(-1)[0]).toUpperCase();
  if (words.length === 1) return words[0][0].toUpperCase();
  return String(fallback).slice(0, 2).toUpperCase();
}

/**
 * Khối tài khoản trên thanh đầu trang: avatar chữ viết tắt + họ tên, bên dưới là vai trò.
 * Họ tên và vai trò lấy từ GET /api/users/me; khi chưa tải xong tạm hiện tên đăng nhập.
 */
export default function HeaderAccount({ user }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let cancelled = false;
    profileService.getMe().then((data) => { if (!cancelled) setProfile(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user.username]);

  const name = profile?.fullName || user.name;
  const role = profile?.roleLabel || ROLE_FALLBACK[String(user.apiRole || '').toUpperCase()] || '';
  const to = user.role === 'admin' ? '/admin' : '/account';

  return (
    <NavLink to={to} title="Thông tin người dùng" aria-label={`${name}${role ? `, ${role}` : ''} — xem thông tin người dùng`}
      className="flex items-center gap-2.5 rounded-xl p-1 sm:pr-2 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors">
      <span aria-hidden="true"
        className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-full bg-gradient-to-br from-[#312E81] via-[#4F46E5] to-[#0E7490] text-white text-sm font-semibold flex items-center justify-center shadow-sm">
        {initialsOf(profile?.fullName, user.name)}
      </span>
      <span className="hidden sm:flex flex-col text-left min-w-0">
        <span className="text-sm font-semibold text-slate-900 leading-tight max-w-[180px] truncate">{name}</span>
        {role && <span className="text-xs text-slate-500 leading-tight">{role}</span>}
      </span>
    </NavLink>
  );
}

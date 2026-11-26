import { useId } from 'react';

/**
 * BrandMark — biểu tượng LibManager, phương án B "Dấu trang chữ L" (Figma: LibManager – Logo mới).
 * Dải bookmark mang chữ L (LibManager), chấm xanh ngọc là "điểm số" của thư viện số.
 * Vector 120×120, gradient chàm → tím → xanh ngọc; kích thước đặt bằng className (vd. "w-10 h-10").
 * Mặc định là hình trang trí (aria-hidden) vì luôn đi kèm chữ "LibManager"; truyền `title` khi đứng một mình.
 */
export default function BrandMark({ className = 'w-10 h-10', title }) {
  const gradientId = `brand-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}
      role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} focusable="false">
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="#312E81" />
          <stop offset="0.55" stopColor="#4F46E5" />
          <stop offset="1" stopColor="#0E7490" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="30" fill={`url(#${gradientId})`} />
      <path d="M40 24h40a6 6 0 0 1 6 6v68l-26-15-26 15V30a6 6 0 0 1 6-6z" fill="#FFFFFF" />
      <path d="M50 38v28h20" stroke="#4F46E5" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="72" cy="40" r="6" fill="#22D3EE" />
    </svg>
  );
}

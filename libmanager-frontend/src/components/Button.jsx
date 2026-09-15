import React from 'react';

/**
 
 * - Base styles: h-12 (48px), px-4, rounded-xl (12px), text-base/text-lg font-semibold, 
 *   inline-flex items-center justify-center gap-2 transition-all duration-200, focus ring chuẩn accessibility.
 * 
 * Props:
 * @param {'primary' | 'outline' | 'ghost' | 'danger'} variant - Kiểu hiển thị của nút
 * @param {'sm' | 'md' | 'lg'} size - Kích thước nút (mặc định 'md' chuẩn h-12)
 * @param {boolean} disabled - Trạng thái vô hiệu hóa
 * @param {boolean} fullWidth - Mở rộng 100% chiều ngang (thường dùng cho mobile)
 * @param {React.ReactNode} children - Nội dung nút
 * @param {React.ReactNode} icon - Biểu tượng đi kèm
 * @param {string} className - Các class Tailwind tùy chỉnh bổ sung
 */
export const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    disabled = false,
    fullWidth = false,
    icon,
    className = '',
    type = 'button',
    onClick,
    ...props
}) => {
    // Base classes dùng chung cho mọi button trong hệ thống
    const baseClasses = [
        'inline-flex items-center justify-center font-semibold select-none',
        'rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
        'active:scale-[0.98]'
    ];

    // Kích thước chuẩn từ hệ thống thiết kế LibManage
    const sizeClasses = {
        sm: 'h-9 px-3 text-sm gap-1.5',
        md: 'h-12 px-4 text-base leading-6 gap-2',
        lg: 'h-14 px-6 text-lg leading-6 gap-2.5',
    };

    // Các biến thể theo đúng đặc tả hệ thống
    const variantClasses = {
        // 1. Primary Button: Nền tím Indigo thương hiệu (#4f46e5 / bg-indigo-600)
        primary: [
            'bg-indigo-600 text-white shadow-sm shadow-indigo-200',
            'hover:bg-indigo-700 active:bg-indigo-800',
            'focus:ring-indigo-500',
            'disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed disabled:active:scale-100',
        ].join(' '),

        // 2. Outline Button: Viền mảnh Slate-200 / Slate-300, nền trắng, chữ xám đậm
        outline: [
            'bg-white border border-slate-200 text-slate-700 shadow-sm',
            'hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900',
            'focus:ring-indigo-500',
            'disabled:bg-slate-50 disabled:border-slate-200 disabled:text-slate-300 disabled:cursor-not-allowed disabled:active:scale-100',
        ].join(' '),

        // 3. Ghost Button: Nền trong suốt, dùng cho thanh điều hướng, action trong bảng, đăng xuất
        ghost: [
            'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            'focus:ring-slate-400',
            'disabled:text-slate-300 disabled:hover:bg-transparent disabled:cursor-not-allowed disabled:active:scale-100',
        ].join(' '),

        // 4. Danger Button (Hủy / Xóa dữ liệu): Nền đỏ nhạt hoặc đỏ đậm
        danger: [
            'bg-rose-600 text-white shadow-sm shadow-rose-200',
            'hover:bg-rose-700 active:bg-rose-800',
            'focus:ring-rose-500',
            'disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:active:scale-100',
        ].join(' '),
    };

    const selectedSize = sizeClasses[size] || sizeClasses.md;
    const selectedVariant = variantClasses[variant] || variantClasses.primary;
    const widthClass = fullWidth ? 'w-full' : '';

    return (
        <button
            type={type}
            disabled={disabled}
            onClick={disabled ? undefined : onClick}
            className={`
        ${baseClasses.join(' ')}
        ${selectedSize}
        ${selectedVariant}
        ${widthClass}
        ${className}
      `.replace(/\s+/g, ' ').trim()}
            {...props}
        >
            {icon && <span className="inline-flex shrink-0 items-center justify-center">{icon}</span>}
            <span>{children}</span>
        </button>
    );
};

export default Button;

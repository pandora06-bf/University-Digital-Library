/**
 * Component Button dùng chung cho cả User Portal (Đạt) và Admin (Vân)
 * 
 * Quy chuẩn:
 * - Giữ nguyên 4 variant gốc: primary, outline, ghost, danger. Hỗ trợ alias 'secondary' -> 'outline'.
 * - Kích thước chuẩn:
 *   + sm: cao 36px (h-9), px-3, text-sm
 *   + md: cao 48px (h-12), px-4, text-[18px] leading-6 font-semibold (chuẩn hóa Figma 18/24/600)
 *   + lg: cao 56px (h-14), px-6, text-lg leading-6
 * - Bổ sung prop loading: spinner loading hiển thị mượt, tự động khóa click chống gửi lặp, aria-busy.
 * - Hỗ trợ đầy đủ cả Named Export (export const Button) và Default Export (export default Button).
 */

export const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    fullWidth = false,
    icon,
    className = '',
    type = 'button',
    onClick,
    ...props
}) => {
    // Ánh xạ alias secondary sang outline theo Figma
    const activeVariantKey = variant === 'secondary' ? 'outline' : variant;

    // Base classes
    const baseClasses = [
        'inline-flex items-center justify-center font-semibold select-none',
        'rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100'
    ];

    // Kích thước chuẩn
    const sizeClasses = {
        sm: 'h-9 px-3 text-sm gap-1.5',
        md: 'h-12 px-4 text-[18px] leading-6 gap-2', // Chuẩn hóa Figma 18/24/600
        lg: 'h-14 px-6 text-lg leading-6 gap-2.5',
    };

    // Các biến thể theo hệ thống thiết kế LibManager
    const variantClasses = {
        // 1. Primary Button: Nền tím Indigo thương hiệu (#4F46E5)
        primary: [
            'bg-[#4F46E5] text-white shadow-sm shadow-indigo-200',
            'hover:bg-[#3730A3] active:bg-[#312E81]',
            'focus-visible:ring-[#4F46E5]',
            'disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed disabled:active:scale-100',
        ].join(' '),

        // 2. Outline Button (Secondary Figma): Viền xanh focus/slate, nền trắng, chữ text-brand (#3730A3)
        outline: [
            'bg-white border border-[#3B82F6] text-[#3730A3] shadow-sm',
            'hover:bg-[#EEF2FF] hover:border-[#2563EB] hover:text-[#312E81]',
            'focus-visible:ring-[#3B82F6]',
            'disabled:bg-slate-50 disabled:border-slate-200 disabled:text-slate-300 disabled:cursor-not-allowed disabled:active:scale-100',
        ].join(' '),

        // 3. Ghost Button: Nền trong suốt
        ghost: [
            'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            'focus-visible:ring-slate-400',
            'disabled:text-slate-300 disabled:hover:bg-transparent disabled:cursor-not-allowed disabled:active:scale-100',
        ].join(' '),

        // 4. Danger Button: Nền đỏ thao tác xóa / hủy
        danger: [
            'bg-rose-600 text-white shadow-sm shadow-rose-200',
            'hover:bg-rose-700 active:bg-rose-800',
            'focus-visible:ring-rose-500',
            'disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:active:scale-100',
        ].join(' '),
    };

    const selectedSize = sizeClasses[size] || sizeClasses.md;
    const selectedVariant = variantClasses[activeVariantKey] || variantClasses.primary;
    const widthClass = fullWidth ? 'w-full' : '';
    const isEffectiveDisabled = disabled || loading;

    return (
        <button
            type={type}
            disabled={isEffectiveDisabled}
            aria-busy={loading ? 'true' : undefined}
            onClick={isEffectiveDisabled ? undefined : onClick}
            className={`
                ${baseClasses.join(' ')}
                ${selectedSize}
                ${selectedVariant}
                ${widthClass}
                ${className}
            `.replace(/\s+/g, ' ').trim()}
            {...props}
        >
            {loading ? (
                <svg
                    className="animate-spin h-5 w-5 text-current shrink-0"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            ) : (
                icon && <span className="inline-flex shrink-0 items-center justify-center">{icon}</span>
            )}
            <span>{children}</span>
        </button>
    );
};

export default Button;

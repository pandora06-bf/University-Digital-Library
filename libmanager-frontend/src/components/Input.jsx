
import React, { forwardRef } from 'react';

/**
 * - Dimensions & Shape: h-12 (48px), w-full, px-4, rounded-xl (12px), border border-slate-300
 * - Typography: text-sm text-slate-900 placeholder:text-slate-400
 * - Interactive States:
 *   + Focus: outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20
 *   + Error: border-rose-500 text-rose-900 focus:border-rose-500 focus:ring-rose-500/20
 *   + Disabled: bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed
 * 
 * Props:
 * @param {string} label - Nhãn hiển thị phía trên input (tùy chọn)
 * @param {string} type - Loại input (text, password, email, number, search,...)
 * @param {string} placeholder - Placeholder text
 * @param {string|number} value - Giá trị input
 * @param {function} onChange - Hàm xử lý sự kiện thay đổi giá trị
 * @param {boolean} disabled - Trạng thái vô hiệu hóa
 * @param {string|boolean} error - Thông báo lỗi hoặc boolean xác định lỗi
 * @param {React.ReactNode} leftIcon - Icon phía trước input (ví dụ search icon)
 * @param {React.ReactNode} rightIcon - Icon phía sau input (ví dụ clear button hoặc barcode icon)
 * @param {string} helperText - Dòng ghi chú nhỏ hỗ trợ bên dưới input
 * @param {string} className - Class tùy chỉnh bổ sung cho input
 * @param {string} containerClassName - Class tùy chỉnh cho wrapper bên ngoài
 */
export const Input = forwardRef(({
    label,
    type = 'text',
    placeholder = '',
    value,
    onChange,
    disabled = false,
    error = false,
    leftIcon,
    rightIcon,
    helperText,
    className = '',
    containerClassName = '',
    id,
    name,
    required = false,
    ...props
}, ref) => {
    const isError = Boolean(error);
    const errorMessage = typeof error === 'string' ? error : null;
    const inputId = id || (name ? `input-${name}` : undefined);

    // Base styling rules theo chuẩn hệ thống
    const baseClasses = 'w-full h-12 text-sm text-slate-900 placeholder:text-slate-400 rounded-xl transition-all duration-200 focus:outline-none';

    // Padding tính toán khi có icon trái/phải
    const paddingClasses = `${leftIcon ? 'pl-11' : 'px-4'} ${rightIcon ? 'pr-11' : 'px-4'}`;

    // State styling classes
    let stateClasses = 'bg-white border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20';

    if (disabled) {
        stateClasses = 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed select-none placeholder:text-slate-300';
    } else if (isError) {
        stateClasses = 'bg-white border border-rose-500 text-rose-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20';
    }

    return (
        <div className={`w-full flex flex-col gap-1.5 ${containerClassName}`}>
            {/* Label */}
            {label && (
                <label
                    htmlFor={inputId}
                    className="text-xs font-semibold text-slate-700 tracking-wide select-none"
                >
                    {label}
                    {required && <span className="text-rose-500 ml-1">*</span>}
                </label>
            )}

            {/* Input container with icon support */}
            <div className="relative w-full flex items-center">
                {leftIcon && (
                    <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
                        {leftIcon}
                    </div>
                )}

                <input
                    ref={ref}
                    id={inputId}
                    name={name}
                    type={type}
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    placeholder={placeholder}
                    required={required}
                    className={`
            ${baseClasses}
            ${paddingClasses}
            ${stateClasses}
            ${className}
          `.replace(/\s+/g, ' ').trim()}
                    {...props}
                />

                {rightIcon && (
                    <div className="absolute right-3.5 flex items-center text-slate-400">
                        {rightIcon}
                    </div>
                )}
            </div>

            {/* Helper text or Error message */}
            {isError && errorMessage ? (
                <p className="text-xs font-medium text-rose-600 mt-0.5 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 inline-block shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errorMessage}
                </p>
            ) : helperText ? (
                <p className="text-xs text-slate-500 mt-0.5">{helperText}</p>
            ) : null}
        </div>
    );
});

Input.displayName = 'Input';

export default Input;

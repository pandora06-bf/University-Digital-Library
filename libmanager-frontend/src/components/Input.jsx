import { forwardRef, useId } from 'react';

/**
 * Component Input dùng chung cho cả User Portal (Đạt) và Admin (Vân)
 * 
 * Quy chuẩn:
 * - Giữ nguyên forwardRef và toàn bộ props cũ: label, type, placeholder, value, onChange, disabled,
 *   error, leftIcon, rightIcon, helperText, className, containerClassName, id, name, required,...
 * - Dùng useId() để tự sinh ID duy nhất và ổn định liên kết giữa label, input, error, helperText.
 * - Hỗ trợ chuẩn ARIA: aria-invalid, aria-describedby tự động gộp với mô tả từ caller.
 * - Chuẩn hóa Typography theo Figma:
 *   + Label: 12/16/500, tracking 0.3px (text-label-md)
 *   + Helper / Error text: 14/20px
 *   + Input value / placeholder: 14/20/400
 *   + Kích thước control: cao 48px, radius 12px (rounded-xl)
 * - Padding tính toán chuẩn xác cho các trường hợp: không icon, icon trái, icon phải, cả 2 icon.
 * - Hỗ trợ cả Named Export (export const Input) và Default Export (export default Input).
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
    'aria-describedby': callerAriaDescribedBy,
    ...props
}, ref) => {
    const isError = Boolean(error);
    const errorMessage = typeof error === 'string' ? error : null;

    // Sinh ID ổn định qua useId nếu caller không truyền id
    const autoId = useId();
    const inputId = id || (name ? `input-${name}-${autoId}` : `input-${autoId}`);
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    // Tính toán aria-describedby
    const describedByList = [];
    if (callerAriaDescribedBy) describedByList.push(callerAriaDescribedBy);
    if (isError && errorMessage) describedByList.push(errorId);
    if (helperText) describedByList.push(helperId);
    const ariaDescribedBy = describedByList.length > 0 ? describedByList.join(' ') : undefined;

    // Base styling
    const baseClasses = 'w-full h-12 text-[14px] leading-[20px] text-[#172033] placeholder:text-[#94A3B8] rounded-xl transition-all duration-200 focus:outline-none';

    // Padding tùy theo icon
    const paddingLeft = leftIcon ? 'pl-11' : 'px-4';
    const paddingRight = rightIcon ? 'pr-11' : 'px-4';
    const paddingClasses = `${paddingLeft} ${paddingRight}`;

    // State styling
    let stateClasses = 'bg-white border border-[#D9E2EE] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20';

    if (disabled) {
        stateClasses = 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed select-none placeholder:text-slate-300';
    } else if (isError) {
        stateClasses = 'bg-white border-[#BE123C] text-[#172033] focus:border-[#BE123C] focus:ring-2 focus:ring-[#BE123C]/20';
    }

    return (
        <div className={`w-full flex flex-col gap-2 ${containerClassName}`}>
            {/* Label */}
            {label && (
                <label
                    htmlFor={inputId}
                    className="text-[12px] leading-[16px] font-medium tracking-[0.3px] text-[#5B6B82] select-none flex items-center"
                >
                    <span>{label}</span>
                    {required && <span className="text-rose-500 ml-1" aria-hidden="true">*</span>}
                </label>
            )}

            {/* Input Wrapper with Icon Support */}
            <div className="relative w-full flex items-center">
                {leftIcon && (
                    <div className="absolute left-3.5 flex items-center justify-center pointer-events-none text-slate-400">
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
                    aria-invalid={isError ? 'true' : undefined}
                    aria-describedby={ariaDescribedBy}
                    className={`
                        ${baseClasses}
                        ${paddingClasses}
                        ${stateClasses}
                        ${className}
                    `.replace(/\s+/g, ' ').trim()}
                    {...props}
                />

                {rightIcon && (
                    <div className="absolute right-3.5 flex items-center justify-center text-slate-400">
                        {rightIcon}
                    </div>
                )}
            </div>

            {/* Error Message */}
            {isError && errorMessage && (
                <p id={errorId} className="text-[14px] leading-[20px] font-normal text-[#BE123C] flex items-center gap-1.5">
                    <svg className="w-4 h-4 inline-block shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>{errorMessage}</span>
                </p>
            )}

            {/* Helper Text (hiển thị khi không có error message) */}
            {(!isError || !errorMessage) && helperText && (
                <p id={helperId} className="text-[14px] leading-[20px] text-[#667085]">
                    {helperText}
                </p>
            )}
        </div>
    );
});

Input.displayName = 'Input';

export default Input;

import React, { forwardRef, useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  onClear?: () => void;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showPasswordToggle?: boolean;
  labelAction?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      required,
      onClear,
      leftIcon,
      rightIcon,
      showPasswordToggle = false,
      labelAction,
      className = '',
      id,
      value,
      onChange,
      disabled,
      type = 'text',
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const hasValue = value !== undefined && value !== null && value !== '';

    const isPasswordType = type === 'password';
    const computedType = isPasswordType ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="w-full space-y-1.5 font-sans">
        {(label || labelAction) && (
          <div className="flex items-center justify-between">
            {label && (
              <label
                htmlFor={inputId}
                className="block text-xs font-semibold text-ink uppercase tracking-wider select-none"
              >
                {label}
                {required && <span className="text-terracotta ml-0.5">*</span>}
              </label>
            )}
            {labelAction && <div className="text-xs">{labelAction}</div>}
          </div>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-ink-muted pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            type={computedType}
            value={value}
            onChange={onChange}
            disabled={disabled}
            className={`w-full px-3.5 py-2.5 text-sm bg-paper-lowest text-ink border rounded-sm outline-none transition-all duration-150 shadow-warm-sm placeholder:text-ink-subtle ${
              leftIcon ? 'pl-10' : ''
            } ${
              (hasValue && onClear) || (isPasswordType && showPasswordToggle) || rightIcon
                ? 'pr-10'
                : ''
            } ${
              error
                ? 'border-brick text-brick focus:border-brick focus:ring-2 focus:ring-brick/20'
                : 'border-paper-border focus:border-terracotta focus:ring-2 focus:ring-terracotta/20'
            } disabled:bg-paper-high disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
            {...props}
          />

          {isPasswordType && showPasswordToggle && !disabled ? (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 p-1 text-ink-muted hover:text-ink rounded-full focus:outline-none transition-colors cursor-pointer"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          ) : hasValue && onClear && !disabled ? (
            <button
              type="button"
              onClick={onClear}
              className="absolute right-3 p-1 text-ink-muted hover:text-ink rounded-full focus:outline-none transition-colors cursor-pointer"
              aria-label="Clear input"
            >
              <X size={14} />
            </button>
          ) : rightIcon ? (
            <div className="absolute right-3 text-ink-muted pointer-events-none flex items-center">
              {rightIcon}
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="text-xs font-medium text-brick flex items-center gap-1 mt-1">
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p className="text-xs text-ink-muted mt-1">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

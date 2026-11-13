import React, { forwardRef } from 'react';

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  helperText?: string;
  error?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ label, helperText, error, checked, disabled, className = '', id, onChange, ...props }, ref) => {
    const radioId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className={`font-sans flex items-start gap-2.5 ${className}`}>
        <div className="relative flex items-center shrink-0 mt-0.5">
          <input
            type="radio"
            id={radioId}
            ref={ref}
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            className="peer sr-only"
            {...props}
          />
          <div
            onClick={() => !disabled && onChange?.({ target: { checked: true } } as any)}
            className={`w-4.5 h-4.5 rounded-full border transition-all duration-150 flex items-center justify-center cursor-pointer shadow-warm-sm ${
              checked
                ? 'border-terracotta bg-paper-lowest'
                : 'bg-paper-lowest border-paper-border peer-focus-visible:ring-2 peer-focus-visible:ring-terracotta/30'
            } ${disabled ? 'opacity-50 cursor-not-allowed bg-paper-high' : 'hover:border-terracotta'}`}
          >
            {checked && <div className="w-2.5 h-2.5 rounded-full bg-terracotta shrink-0" />}
          </div>
        </div>

        {(label || helperText) && (
          <div className="text-sm select-none">
            {label && (
              <label
                htmlFor={radioId}
                className={`font-medium cursor-pointer ${
                  disabled ? 'text-ink-muted cursor-not-allowed' : 'text-ink'
                }`}
              >
                {label}
              </label>
            )}
            {helperText && <p className="text-xs text-ink-muted mt-0.5">{helperText}</p>}
            {error && <p className="text-xs text-brick font-medium mt-0.5">{error}</p>}
          </div>
        )}
      </div>
    );
  }
);

Radio.displayName = 'Radio';

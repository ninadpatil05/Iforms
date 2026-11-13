import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const inputId = id || label.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full space-y-1.5">
        <label
          htmlFor={inputId}
          className="block font-mono text-[10px] uppercase tracking-[0.14em] text-paper-muted"
        >
          {label}
        </label>
        <div className="relative">
          <input
            id={inputId}
            ref={ref}
            className={`w-full px-3.5 py-2.5 rounded bg-transparent text-sm text-paper-text outline-none transition-all duration-160 ease-out dark:text-paper-text-dark
              ${
                error
                  ? 'border-2 border-paper-text dark:border-paper-text-dark'
                  : 'border border-paper-muted focus:border-paper-ink dark:focus:border-paper-text-dark'
              }
              ${className}`}
            {...props}
          />
        </div>
        {error ? (
          <p className="font-mono text-[10px] uppercase tracking-wide text-paper-text dark:text-paper-text-dark">{error}</p>
        ) : helperText ? (
          <p className="font-mono text-[10px] uppercase tracking-wide text-paper-muted">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

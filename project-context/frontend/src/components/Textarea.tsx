import React, { forwardRef } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, required, className = '', id, disabled, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 font-sans">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs font-semibold text-ink uppercase tracking-wider"
          >
            {label}
            {required && <span className="text-terracotta ml-0.5">*</span>}
          </label>
        )}

        <textarea
          id={textareaId}
          ref={ref}
          disabled={disabled}
          className={`w-full px-3 py-2 text-sm bg-paper-lowest text-ink border rounded-sm outline-none transition-all duration-150 shadow-warm-sm placeholder:text-ink-subtle min-h-[90px] resize-y ${
            error
              ? 'border-brick text-brick focus:border-brick focus:ring-2 focus:ring-brick/20'
              : 'border-paper-border focus:border-terracotta focus:ring-2 focus:ring-terracotta/20'
          } disabled:bg-paper-high disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
          {...props}
        />

        {error ? (
          <p className="text-xs font-medium text-brick mt-1">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-ink-muted mt-1">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

import React from 'react';

export interface SwitchProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  helperText?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  id?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  label,
  helperText,
  size = 'md',
  className = '',
  id,
}) => {
  const toggleId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  const handleToggle = () => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };

  const trackDimensions = {
    sm: 'w-8 h-4.5 p-0.5',
    md: 'w-11 h-6 p-0.5',
    lg: 'w-14 h-7.5 p-1',
  };

  const thumbDimensions = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-5.5 h-5.5',
  };

  const translatePosition = {
    sm: checked ? 'translate-x-3.5' : 'translate-x-0',
    md: checked ? 'translate-x-5' : 'translate-x-0',
    lg: checked ? 'translate-x-6.5' : 'translate-x-0',
  };

  return (
    <div className={`font-sans flex items-start gap-3 ${className}`}>
      <button
        type="button"
        role="switch"
        id={toggleId}
        aria-checked={checked}
        disabled={disabled}
        onClick={handleToggle}
        className={`relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out cursor-pointer shadow-warm-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 ${
          trackDimensions[size]
        } ${
          checked
            ? 'bg-terracotta'
            : 'bg-paper-high border border-paper-border'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span
          className={`pointer-events-none inline-block rounded-full bg-white shadow-warm-md transform ring-0 transition duration-200 ease-in-out ${
            thumbDimensions[size]
          } ${translatePosition[size]}`}
        />
      </button>

      {(label || helperText) && (
        <div className="text-sm select-none">
          {label && (
            <label
              htmlFor={toggleId}
              onClick={handleToggle}
              className={`font-medium cursor-pointer ${
                disabled ? 'text-ink-muted cursor-not-allowed' : 'text-ink'
              }`}
            >
              {label}
            </label>
          )}
          {helperText && <p className="text-xs text-ink-muted mt-0.5">{helperText}</p>}
        </div>
      )}
    </div>
  );
};

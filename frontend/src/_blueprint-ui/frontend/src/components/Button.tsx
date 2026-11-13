import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center rounded font-semibold font-sans transition-all duration-160 ease-out disabled:opacity-50 disabled:pointer-events-none border';

  // "primary" and "secondary" both resolve to the solid ink fill — the design
  // system defines solid / outline / ghost, mapped onto the existing variant names
  // so every call site keeps working unchanged.
  const variantStyles = {
    primary:
      'border-paper-ink bg-paper-ink text-paper-base hover:brightness-110 hover:border-paper-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-paper-ink',
    secondary:
      'border-paper-muted bg-transparent text-paper-text hover:bg-paper-card/60 hover:border-paper-text dark:text-paper-text-dark dark:hover:bg-paper-card-dark/60',
    outline:
      'border-paper-muted bg-transparent text-paper-text hover:border-paper-ink hover:text-paper-ink dark:text-paper-text-dark dark:hover:text-paper-text-dark dark:hover:border-paper-text-dark',
    danger:
      'border-paper-text bg-transparent text-paper-text hover:bg-paper-text hover:text-paper-base dark:border-paper-text-dark dark:text-paper-text-dark dark:hover:bg-paper-text-dark dark:hover:text-paper-base-dark',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center space-x-2 font-mono text-[11px] uppercase tracking-wide">
          <svg className="w-3.5 h-3.5 animate-spin text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Processing</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};

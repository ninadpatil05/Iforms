import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium font-sans rounded-sm transition-all duration-150 ease-in-out cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed';

  const variantClasses = {
    primary:
      'bg-terracotta text-paper-lowest hover:bg-terracotta-hover active:bg-terracotta-active shadow-warm-sm hover:shadow-warm-md text-white font-medium border border-transparent',
    secondary:
      'bg-sage text-paper-lowest hover:bg-sage-hover active:bg-sage text-white font-medium shadow-warm-sm border border-transparent',
    outline:
      'bg-paper-lowest text-ink border border-paper-border hover:bg-paper-high hover:border-ink-subtle shadow-warm-sm',
    ghost:
      'bg-transparent text-ink hover:bg-paper-high hover:text-ink active:bg-paper-border border border-transparent',
    danger:
      'bg-brick text-paper-lowest hover:bg-brick-hover active:bg-brick text-white shadow-warm-sm hover:shadow-warm-md border border-transparent',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs gap-1.5 h-8',
    md: 'px-4 py-2 text-sm gap-2 h-10',
    lg: 'px-5 py-2.5 text-base gap-2.5 h-12',
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18,
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="animate-spin text-current" size={iconSizes[size]} />
      ) : (
        leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
      )}
      {children && <span>{children}</span>}
      {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  );
};

export const IconButton: React.FC<{
  icon: React.ElementType;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  label?: string;
  active?: boolean;
  variant?: 'outline' | 'ghost' | 'primary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
}> = ({ icon: Icon, onClick, label, active, variant = 'outline', size = 'md', className = '', disabled }) => {
  const sizeMap = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
  };
  const iconSizeMap = { sm: 14, md: 18, lg: 20 };

  const variantMap = {
    outline: 'border border-paper-border bg-paper-lowest text-ink hover:bg-paper-high',
    ghost: 'border border-transparent bg-transparent text-ink hover:bg-paper-high',
    primary: 'border border-transparent bg-terracotta text-white hover:bg-terracotta-hover',
  };

  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-sm transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${
        sizeMap[size]
      } ${variantMap[variant]} ${active ? '!bg-terracotta-fixed !text-terracotta !border-terracotta' : ''} ${className}`}
    >
      <Icon size={iconSizeMap[size]} />
    </button>
  );
};

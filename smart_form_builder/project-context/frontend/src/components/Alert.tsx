import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type AlertVariant = 'info' | 'warning' | 'error' | 'success';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  onClose,
  action,
  className = '',
}) => {
  const variantStyles = {
    info: {
      bg: 'bg-[#F5F2EA] dark:bg-[#25231D] border-[#E2DDD3] dark:border-[#3D3A31] text-[#2B2620] dark:text-[#FAF7F0]',
      icon: <Info className="w-5 h-5 text-[#7C9070] dark:text-[#A3B897] flex-shrink-0 mt-0.5" />,
    },
    warning: {
      bg: 'bg-[#FDF6E2] dark:bg-[#332410] border-[#F5E2B3] dark:border-[#523A1A] text-[#78350F] dark:text-[#FDF6E2]',
      icon: <AlertTriangle className="w-5 h-5 text-[#B45309] dark:text-[#FBBF24] flex-shrink-0 mt-0.5" />,
    },
    error: {
      bg: 'bg-[#FDF2F2] dark:bg-[#341616] border-[#F8C4C4] dark:border-[#522222] text-[#7F1D1D] dark:text-[#FDF2F2]',
      icon: <XCircle className="w-5 h-5 text-[#B5302E] dark:text-[#F87171] flex-shrink-0 mt-0.5" />,
    },
    success: {
      bg: 'bg-[#EAF4ED] dark:bg-[#182B1E] border-[#C2E2CB] dark:border-[#274830] text-[#1E462A] dark:text-[#EAF4ED]',
      icon: <CheckCircle2 className="w-5 h-5 text-[#2E6B40] dark:text-[#4ADE80] flex-shrink-0 mt-0.5" />,
    },
  };

  const style = variantStyles[variant];

  return (
    <div
      className={`font-sans rounded-[8px] border p-4 flex items-start gap-3 transition-all ${style.bg} ${className}`}
      role="alert"
    >
      {style.icon}
      <div className="flex-1 min-w-0">
        {title && <h4 className="text-sm font-semibold mb-0.5 leading-tight">{title}</h4>}
        <div className="text-xs leading-relaxed opacity-90">{children}</div>
        {action && <div className="mt-2.5">{action}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-[4px] opacity-70 hover:opacity-100 transition-opacity -mr-1 -mt-1"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default Alert;

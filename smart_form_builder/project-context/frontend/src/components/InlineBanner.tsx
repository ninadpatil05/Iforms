import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type BannerVariant = 'info' | 'warning' | 'error' | 'success';

export interface InlineBannerProps {
  variant?: BannerVariant;
  title?: string;
  message: React.ReactNode;
  onDismiss?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export const InlineBanner: React.FC<InlineBannerProps> = ({
  variant = 'info',
  title,
  message,
  onDismiss,
  action,
  className = '',
}) => {
  const variantStyles = {
    info: {
      bg: 'bg-terracotta-fixed/60 border-terracotta/30 text-ink',
      iconBg: 'text-terracotta',
      icon: Info,
    },
    success: {
      bg: 'bg-forest-container/60 border-forest-border text-ink',
      iconBg: 'text-forest',
      icon: CheckCircle2,
    },
    warning: {
      bg: 'bg-amber-container/70 border-amber-border text-ink',
      iconBg: 'text-amber',
      icon: AlertTriangle,
    },
    error: {
      bg: 'bg-brick-container/70 border-brick-border text-ink',
      iconBg: 'text-brick',
      icon: AlertCircle,
    },
  };

  const style = variantStyles[variant];
  const IconComponent = style.icon;

  return (
    <div
      className={`font-sans rounded-md border p-4 flex items-start gap-3 shadow-warm-sm transition-all ${style.bg} ${className}`}
      role="alert"
    >
      <div className={`p-1 shrink-0 ${style.iconBg} mt-0.5`}>
        <IconComponent size={18} />
      </div>

      <div className="flex-1 text-sm min-w-0">
        {title && <h5 className="font-semibold text-ink font-sans leading-snug">{title}</h5>}
        <div className="text-ink-muted text-xs sm:text-sm mt-0.5 leading-relaxed">{message}</div>
        {action && <div className="mt-2.5">{action}</div>}
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-ink-muted hover:text-ink p-1 rounded-sm transition-colors cursor-pointer shrink-0 ml-2"
          aria-label="Dismiss banner"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

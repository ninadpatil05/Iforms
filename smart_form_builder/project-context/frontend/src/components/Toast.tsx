import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  variant?: ToastVariant;
  duration?: number; // duration in ms, default 4000
}

interface ToastMessageProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

export const ToastMessage: React.FC<ToastMessageProps> = ({ toast, onDismiss }) => {
  const { id, title, message, variant = 'info', duration = 4000 } = toast;
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (duration <= 0) return;
    const intervalTime = 50;
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          onDismiss(id);
          return 0;
        }
        return prev - step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [id, duration, onDismiss]);

  const variantStyles = {
    success: {
      border: 'border-forest-border',
      bg: 'bg-paper-lowest',
      iconBg: 'bg-forest-container text-forest',
      progressBg: 'bg-forest',
      icon: CheckCircle2,
    },
    error: {
      border: 'border-brick-border',
      bg: 'bg-paper-lowest',
      iconBg: 'bg-brick-container text-brick',
      progressBg: 'bg-brick',
      icon: AlertCircle,
    },
    warning: {
      border: 'border-amber-border',
      bg: 'bg-paper-lowest',
      iconBg: 'bg-amber-container text-amber',
      progressBg: 'bg-amber',
      icon: AlertTriangle,
    },
    info: {
      border: 'border-paper-border',
      bg: 'bg-paper-lowest',
      iconBg: 'bg-terracotta-fixed text-terracotta',
      progressBg: 'bg-terracotta',
      icon: Info,
    },
  };

  const style = variantStyles[variant];
  const IconComponent = style.icon;

  return (
    <div
      className={`relative z-50 w-80 sm:w-96 rounded-md border ${style.border} ${style.bg} shadow-warm-lift overflow-hidden transition-all duration-300 animate-in slide-in-from-right-8 fade-in`}
      role="alert"
    >
      <div className="p-4 flex items-start gap-3">
        <div className={`p-2 rounded-sm ${style.iconBg} shrink-0`}>
          <IconComponent size={18} />
        </div>

        <div className="flex-1 min-w-0 pr-2">
          <h4 className="text-sm font-semibold text-ink font-sans leading-tight">{title}</h4>
          {message && <p className="text-xs text-ink-muted mt-1 leading-relaxed">{message}</p>}
        </div>

        <button
          onClick={() => onDismiss(id)}
          className="text-ink-muted hover:text-ink p-1 rounded-sm transition-colors cursor-pointer shrink-0"
          aria-label="Dismiss toast"
        >
          <X size={14} />
        </button>
      </div>

      {duration > 0 && (
        <div className="w-full bg-paper-high h-1 overflow-hidden">
          <div
            className={`h-full ${style.progressBg} transition-all duration-75 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

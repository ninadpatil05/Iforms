import React, { useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete Form',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const firstBtn = actionsRef.current?.querySelector<HTMLButtonElement>('button');
      firstBtn?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const iconStyles = {
    danger: 'bg-brick-container text-brick border-brick-border',
    warning: 'bg-amber-container text-amber border-amber-border',
    primary: 'bg-terracotta-fixed text-terracotta border-terracotta/30',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog Card */}
      <div className="relative z-10 w-full max-w-md bg-paper-lowest rounded-lg border border-paper-border shadow-warm-lift p-6 space-y-5 animate-in zoom-in-95 fade-in duration-200 text-ink">
        <div className="flex items-start gap-4">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-full border flex items-center justify-center ${iconStyles[variant]}`}
          >
            <AlertCircle size={20} />
          </div>

          <div className="flex-1">
            <h3
              id="confirm-dialog-title"
              className="font-serif text-lg font-bold text-ink tracking-tight"
            >
              {title}
            </h3>
            <p className="mt-1.5 text-sm text-ink-muted leading-relaxed font-sans">{message}</p>
          </div>
        </div>

        <div ref={actionsRef} className="flex items-center justify-end gap-3 pt-2">
          <Button variant="ghost" size="md" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="md"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

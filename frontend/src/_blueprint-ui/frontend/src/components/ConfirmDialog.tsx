import React, { useEffect, useRef } from 'react';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  // Button is not forwardRef — use a div wrapper ref to imperatively focus
  const actionsRef = useRef<HTMLDivElement>(null);

  // Focus the first (cancel) button on open — safe default for destructive dialogs
  useEffect(() => {
    if (isOpen) {
      const firstBtn = actionsRef.current?.querySelector<HTMLButtonElement>('button');
      firstBtn?.focus();
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Flat near-black backdrop, low opacity — no blur, no gradient */}
      <div
        className="absolute inset-0 bg-paper-base-dark/50 bp-fade-in"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="bp-fade-in relative z-10 w-full max-w-sm rounded border border-paper-muted bg-paper-base dark:bg-paper-base-dark p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-9 h-9 rounded border border-paper-muted flex items-center justify-center text-paper-text dark:text-paper-text-dark">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h2
              id="confirm-dialog-title"
              className="text-sm font-semibold uppercase tracking-wide text-paper-text dark:text-paper-text-dark"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-paper-muted leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div ref={actionsRef} className="flex items-center justify-end gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            size="sm"
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

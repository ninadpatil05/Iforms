import React from 'react';

export interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className = '',
}) => {
  return (
    <div
      className={`font-sans flex flex-col items-center justify-center text-center p-8 sm:p-12 border border-dashed border-paper-border rounded-md bg-paper-lowest/50 ${className}`}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-terracotta-fixed text-terracotta flex items-center justify-center mb-4 shadow-warm-sm">
          <Icon size={24} />
        </div>
      )}

      <h3 className="font-serif text-lg font-bold text-ink tracking-tight">{title}</h3>

      {description && (
        <p className="text-sm text-ink-muted mt-1.5 max-w-md leading-relaxed">{description}</p>
      )}

      {(primaryAction || secondaryAction) && (
        <div className="flex items-center gap-3 mt-6">
          {secondaryAction}
          {primaryAction}
        </div>
      )}
    </div>
  );
};

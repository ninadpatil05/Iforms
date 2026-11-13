import React from 'react';

export type StatusType = 'Live' | 'published' | 'Draft' | 'draft' | 'Closed' | 'archived' | 'Complete' | 'Incomplete';

interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const norm = (status || 'Draft').toLowerCase();

  let colors = {
    fg: 'var(--color-amber)',
    bg: 'var(--color-amber-tint)',
  };

  if (norm === 'live' || norm === 'published' || norm === 'complete') {
    colors = {
      fg: 'var(--color-success)',
      bg: 'var(--color-success-tint)',
    };
  } else if (norm === 'closed' || norm === 'archived' || norm === 'incomplete') {
    colors = {
      fg: 'var(--color-danger)',
      bg: 'var(--color-danger-tint)',
    };
  }

  const displayLabel = status.toUpperCase();

  return (
    <span
      className={`inline-flex items-center font-mono text-[11px] tracking-[0.4px] font-semibold px-2 py-0.5 border ${className}`}
      style={{
        color: colors.fg,
        backgroundColor: colors.bg,
        borderColor: `${colors.fg}44`,
      }}
    >
      {displayLabel}
    </span>
  );
};

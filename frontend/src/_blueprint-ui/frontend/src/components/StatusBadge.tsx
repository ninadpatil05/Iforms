import React from 'react';
import { FormStatus } from '@/types/form';

interface StatusBadgeProps {
  status: FormStatus;
}

// Monochrome system: status is read from border weight / fill, never color.
// draft = outline only · published = filled ink · archived = muted fill.
const config: Record<FormStatus, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className: 'border border-paper-muted text-paper-text dark:text-paper-text-dark bg-transparent',
  },
  published: {
    label: 'Published',
    className: 'border border-paper-ink bg-paper-ink text-paper-base',
  },
  archived: {
    label: 'Archived',
    className: 'border border-paper-muted bg-paper-muted/30 text-paper-muted',
  },
  trashed: {
    label: 'Trash',
    className: 'border border-brick bg-brick-container text-brick',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const { label, className } = config[status] ?? config.draft;
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${className}`}
    >
      {label}
    </span>
  );
};

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import type { Field } from '@/types/field';
import { FieldTypeIcon, fieldTypeLabel } from './FieldTypeIcon';

export const FieldCard = ({ field, onEdit, onDelete }: { field: Field; onEdit: () => void; onDelete: () => void }) => {
  const sortable = useSortable({ id: field.id });
  return (
    <div
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      className={`flex items-center gap-3 rounded border bg-transparent p-4 transition-all duration-160 ease-out ${
        sortable.isDragging ? 'opacity-60 border-paper-ink dark:border-paper-text-dark' : 'border-paper-muted'
      }`}
    >
      <button {...sortable.attributes} {...sortable.listeners} aria-label={`Reorder ${field.label}`} className="cursor-grab touch-none p-1.5 text-paper-muted hover:text-paper-ink dark:hover:text-paper-text-dark">
        <GripVertical className="w-4 h-4" />
      </button>
      <FieldTypeIcon type={field.field_type} className="w-9 h-9" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-sm text-paper-text dark:text-paper-text-dark">{field.label}</p>
        <p className="font-mono text-[10px] uppercase tracking-wide text-paper-muted">{fieldTypeLabel(field.field_type)}</p>
      </div>
      {field.required && <span className="font-mono text-[10px] uppercase tracking-wide text-paper-muted">*REQ</span>}
      <button onClick={onEdit} aria-label={`Edit ${field.label}`} className="rounded p-2 text-paper-muted hover:text-paper-ink dark:hover:text-paper-text-dark">
        <Pencil className="w-4 h-4" />
      </button>
      <button onClick={onDelete} aria-label={`Delete ${field.label}`} className="rounded p-2 text-paper-muted hover:text-paper-text dark:hover:text-paper-text-dark">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

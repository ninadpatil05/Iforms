import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import type { Field } from '@/types/field';
import { FieldTypeIcon, fieldTypeLabel } from './FieldTypeIcon';
import { CornerBrackets } from './CornerBrackets';

export const FieldCard = ({ field, onEdit, onDelete }: { field: Field; onEdit: () => void; onDelete: () => void }) => {
  const sortable = useSortable({ id: field.id });
  const isDragging = sortable.isDragging;

  return (
    <div
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      className={`relative flex items-center gap-3 bg-white p-3.5 border text-ink transition-all duration-150 ${
        isDragging
          ? 'opacity-60 border-dashed border-cyan bg-cyan-tint'
          : 'border-ink/25 hover:border-cyan'
      }`}
    >
      {isDragging && <CornerBrackets active />}
      <button
        {...sortable.attributes}
        {...sortable.listeners}
        aria-label={`Reorder ${field.label}`}
        className="cursor-grab touch-none p-1 text-slate hover:text-ink bg-transparent border-none"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <FieldTypeIcon type={field.field_type} className="w-7 h-7 text-cyan-dark" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-sans font-semibold text-sm text-ink">{field.label}</p>
        <p className="font-mono text-[10px] uppercase tracking-wide text-slate-light">{fieldTypeLabel(field.field_type)}</p>
      </div>
      {field.required && (
        <span className="font-mono text-[10px] uppercase tracking-wide px-1.5 py-0.5 bg-amber-tint text-amber border border-amber/40 font-semibold">
          REQ
        </span>
      )}
      <button
        onClick={onEdit}
        aria-label={`Edit ${field.label}`}
        className="p-1.5 border border-ink/20 bg-cream-soft text-slate hover:text-ink cursor-pointer"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onDelete}
        aria-label={`Delete ${field.label}`}
        className="p-1.5 border border-ink/20 bg-cream-soft text-slate hover:text-danger cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

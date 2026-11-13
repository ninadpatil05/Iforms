import { AlignLeft, Calendar, CheckSquare, ChevronDown, CircleDot, Hash, KeyRound, Mail, Paperclip, Star, Type, Upload, Calculator } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { FieldType } from '@/types/field';

// Monochrome system: every field type gets the same bordered chip treatment.
// No color-coding by type — differentiation comes from the icon alone.
const config: Record<FieldType, LucideIcon> = {
  text: Type,
  number: Hash,
  email: Mail,
  date: Calendar,
  dropdown: ChevronDown,
  checkbox: CheckSquare,
  file_upload: Upload,
  rating: Star,
  password: KeyRound,
  file: Paperclip,
  textarea: AlignLeft,
  radio: CircleDot,
  computed: Calculator,
};

export const fieldTypeLabel = (type: FieldType) => type ? type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';

export const FieldTypeIcon = ({ type, className = '' }: { type: FieldType; className?: string }) => {
  const Icon = config[type] || Type;
  return (
    <span
      className={`inline-flex items-center justify-center rounded border border-paper-muted text-paper-text dark:text-paper-text-dark bg-transparent ${className}`}
    >
      <Icon className="w-4 h-4" />
    </span>
  );
};


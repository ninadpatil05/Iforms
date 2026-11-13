import type { Field } from '@/types/field';

interface ComparisonValueInputProps {
  selectedField?: Field;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

const CHOICE_FIELD_TYPES = ['dropdown', 'checkbox', 'radio'];

export const ComparisonValueInput = ({
  selectedField,
  value,
  onChange,
  placeholder = 'e.g. Yes or 18',
  className = 'w-full rounded border border-paper-muted bg-transparent px-2.5 py-1.5 text-xs text-paper-text dark:text-paper-text-dark outline-none focus:border-paper-ink dark:focus:border-paper-text-dark',
}: ComparisonValueInputProps) => {
  const isChoiceField =
    selectedField &&
    CHOICE_FIELD_TYPES.includes(selectedField.field_type) &&
    selectedField.options &&
    selectedField.options.length > 0;

  if (isChoiceField) {
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={className}
      >
        <option value="">Select a value…</option>
        {selectedField.options!.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );
};

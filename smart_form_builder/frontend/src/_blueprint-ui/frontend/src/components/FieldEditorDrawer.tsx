import { useEffect, useState } from 'react';
import { Check, Plus, Star, Trash2, X } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { FieldTypeIcon, fieldTypeLabel } from './FieldTypeIcon';
import type { Field, FieldCreatePayload, FieldOption, FieldType } from '@/types/field';

const types: FieldType[] = ['text', 'number', 'email', 'date', 'dropdown', 'checkbox', 'file_upload', 'rating'];
const choices = new Set<FieldType>(['dropdown', 'checkbox']);
const numeric = new Set<FieldType>(['number', 'rating']);

export const FieldEditorDrawer = ({ field, versionId, onClose, onSave }: { field?: Field; versionId: number; onClose: () => void; onSave: (payload: FieldCreatePayload | Partial<FieldCreatePayload>) => Promise<void> }) => {
  const [type, setType] = useState<FieldType>(field?.field_type ?? 'text');
  const [label, setLabel] = useState(field?.label ?? '');
  const [required, setRequired] = useState(field?.required ?? false);
  const [options, setOptions] = useState<FieldOption[]>(field?.options ?? [{ label: 'Option 1', value: 'option_1' }]);
  const [min, setMin] = useState(String(field?.validation_config?.min ?? field?.validation_config?.min_length ?? ''));
  const [max, setMax] = useState(String(field?.validation_config?.max ?? field?.validation_config?.max_length ?? ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const close = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onClose]);
  const submit = async () => {
    if (!label.trim()) return setError('A field label is required.');
    setSaving(true); setError('');
    const config: Record<string, number> = {};
    if (min !== '') config[numeric.has(type) ? 'min' : 'min_length'] = Number(min);
    if (max !== '') config[numeric.has(type) ? 'max' : 'max_length'] = Number(max);
    try { await onSave({ ...(field ? {} : { form_version_id: versionId }), label: label.trim(), field_type: type, required, options: choices.has(type) ? options.filter(o => o.label.trim() && o.value.trim()) : null, validation_config: Object.keys(config).length ? config : null }); onClose(); } catch { setError('Could not save this field. Please try again.'); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Close editor" onClick={onClose} className="absolute inset-0 bg-paper-base-dark/50 bp-fade-in" />
      <aside className="bp-slide-in relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-paper-muted bg-paper-base p-5 dark:bg-paper-base-dark sm:p-7">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper-muted">Form Builder</p>
            <h2 className="mt-1 text-xl font-semibold text-paper-text dark:text-paper-text-dark">{field ? 'Edit field' : 'Add a field'}</h2>
          </div>
          <button onClick={onClose} className="rounded p-2 text-paper-muted hover:text-paper-ink dark:hover:text-paper-text-dark">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-paper-muted">Field type</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {types.map(item => (
            <button
              key={item}
              onClick={() => setType(item)}
              className={`flex flex-col items-center gap-2 rounded border p-3 text-xs font-semibold transition-all duration-160 ease-out ${
                type === item
                  ? 'border-paper-ink dark:border-paper-text-dark text-paper-text dark:text-paper-text-dark'
                  : 'border-paper-muted text-paper-muted hover:border-paper-ink dark:hover:border-paper-text-dark'
              }`}
            >
              <FieldTypeIcon type={item} className="h-8 w-8" />
              {fieldTypeLabel(item)}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          <Input label="Label" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Your full name" required />

          <label className="flex cursor-pointer items-center justify-between rounded border border-paper-muted p-3">
            <span>
              <span className="block text-sm font-semibold text-paper-text dark:text-paper-text-dark">Required response</span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-paper-muted">Respondents must complete this field</span>
            </span>
            <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} className="peer sr-only" />
            <span className="relative h-5 w-9 rounded-full border border-paper-muted transition-colors duration-160 ease-out peer-checked:bg-paper-ink peer-checked:border-paper-ink after:absolute after:left-0.5 after:top-0.5 after:h-3.5 after:w-3.5 after:rounded-full after:bg-paper-muted after:transition-all after:duration-160 after:ease-out peer-checked:after:bg-paper-base peer-checked:after:translate-x-4" />
          </label>

          {choices.has(type) && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-muted">Options</p>
                <button onClick={() => setOptions([...options, { label: `Option ${options.length + 1}`, value: `option_${options.length + 1}` }])} className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-paper-ink dark:text-paper-text-dark">
                  <Plus className="w-3.5 h-3.5" /> Add option
                </button>
              </div>
              {options.map((option, index) => (
                <div key={index} className="mb-2 flex gap-2">
                  <input
                    value={option.label}
                    onChange={e => setOptions(options.map((item, i) => i === index ? { ...item, label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') } : item))}
                    className="min-w-0 flex-1 rounded border border-paper-muted bg-transparent px-3 py-2 text-sm text-paper-text dark:text-paper-text-dark focus:border-paper-ink dark:focus:border-paper-text-dark outline-none transition-all duration-160 ease-out"
                  />
                  <button onClick={() => setOptions(options.filter((_, i) => i !== index))} className="p-2 text-paper-muted hover:text-paper-text dark:hover:text-paper-text-dark">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {(type === 'text' || numeric.has(type)) && (
            <div className="grid grid-cols-2 gap-3">
              <Input label={numeric.has(type) ? 'Minimum' : 'Min length'} type="number" value={min} onChange={e => setMin(e.target.value)} />
              <Input label={numeric.has(type) ? 'Maximum' : 'Max length'} type="number" value={max} onChange={e => setMax(e.target.value)} />
            </div>
          )}
        </div>

        {/* Live preview */}
        <div className="mt-6 rounded border border-paper-muted p-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-paper-muted">Live preview</p>
          <label className="mb-1 block text-sm font-semibold text-paper-text dark:text-paper-text-dark">
            {label || 'Untitled field'} {required && <span>*</span>}
          </label>
          {type === 'dropdown' ? (
            <select className="w-full rounded border border-paper-muted bg-transparent p-2.5 text-sm text-paper-text dark:text-paper-text-dark">
              {options.map(o => <option key={o.value}>{o.label}</option>)}
            </select>
          ) : type === 'checkbox' ? (
            <div className="space-y-2">
              {options.map(o => (
                <label key={o.value} className="flex items-center gap-2 text-sm text-paper-text dark:text-paper-text-dark">
                  <input type="checkbox" /> {o.label}
                </label>
              ))}
            </div>
          ) : type === 'rating' ? (
            <div className="flex gap-1 text-paper-muted">
              {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-5 h-5" />)}
            </div>
          ) : type === 'file_upload' ? (
            <div className="rounded border border-dashed border-paper-muted p-4 text-center text-sm text-paper-muted">
              Choose a file or drag it here
            </div>
          ) : (
            <input type={type} placeholder="Your answer" className="w-full rounded border border-paper-muted bg-transparent p-2.5 text-sm text-paper-text dark:text-paper-text-dark" />
          )}
        </div>

        {error && <p className="mt-3 font-mono text-[10px] uppercase tracking-wide text-paper-text dark:text-paper-text-dark">{error}</p>}
        <div className="mt-auto flex justify-end gap-3 pt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button isLoading={saving} onClick={submit}><Check className="mr-1 w-4 h-4" />Save field</Button>
        </div>
      </aside>
    </div>
  );
};

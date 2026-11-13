import { useEffect, useState, useMemo } from 'react';
import { Check, ChevronDown, Plus, Star, Trash2, X, Eye, Calculator, Lock } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { CornerBrackets } from './CornerBrackets';
import { FieldTypeIcon, fieldTypeLabel } from './FieldTypeIcon';
import { ConditionGroupDrawer } from './ConditionGroupDrawer';
import type { Field, FieldCreatePayload, FieldOption, FieldType, FormulaTerm, FormulaOp } from '@/types/field';
import type { Section } from '@/types/section';

const types: FieldType[] = ['text', 'number', 'email', 'date', 'dropdown', 'checkbox', 'file_upload', 'rating', 'computed'];
const choices = new Set<FieldType>(['dropdown', 'checkbox']);
const numeric = new Set<FieldType>(['number', 'rating']);

interface FieldEditorDrawerProps {
  field?: Field;
  versionId: number;
  sections?: Section[];
  allFields?: Field[];
  defaultSectionId?: number | null;
  onClose: () => void;
  onSave: (payload: FieldCreatePayload | Partial<FieldCreatePayload>) => Promise<void>;
}

export const FieldEditorDrawer = ({
  field,
  versionId,
  sections = [],
  allFields = [],
  defaultSectionId,
  onClose,
  onSave,
}: FieldEditorDrawerProps) => {
  const [type, setType] = useState<FieldType>(field?.field_type ?? 'text');
  const [label, setLabel] = useState(field?.label ?? '');
  const [required, setRequired] = useState(field?.required ?? false);
  const [options, setOptions] = useState<FieldOption[]>(field?.options ?? [{ label: 'Option 1', value: 'option_1' }]);
  const [min, setMin] = useState(String(field?.validation_config?.min ?? field?.validation_config?.min_length ?? ''));
  const [max, setMax] = useState(String(field?.validation_config?.max ?? field?.validation_config?.max_length ?? ''));
  const [defaultValue, setDefaultValue] = useState<string>(
    field?.validation_config?.default_value !== undefined && field?.validation_config?.default_value !== null
      ? String(field.validation_config.default_value)
      : ''
  );
  const [readOnly, setReadOnly] = useState<boolean>(!!field?.validation_config?.read_only);

  const [sectionId, setSectionId] = useState<number | null>(field?.section_id ?? defaultSectionId ?? null);
  const [showConditionDrawer, setShowConditionDrawer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const eligibleOperands = useMemo(() => {
    return allFields.filter(f => f.id !== field?.id && (f.field_type === 'number' || f.field_type === 'rating' || f.field_type === 'computed'));
  }, [allFields, field]);

  const [formulaTerms, setFormulaTerms] = useState<FormulaTerm[]>(() => {
    if (field?.field_type === 'computed' && field.validation_config?.terms) {
      return field.validation_config.terms as FormulaTerm[];
    }
    const defaultOpId = eligibleOperands[0]?.id;
    return defaultOpId ? [{ field_id: defaultOpId }] : [{ constant_value: 0 }];
  });
  const [decimalPlaces, setDecimalPlaces] = useState<number>(field?.validation_config?.decimal_places ?? 2);

  useEffect(() => {
    const close = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  const addFormulaOperand = () => {
    const defaultOpId = eligibleOperands[0]?.id;
    const newTerm: FormulaTerm = defaultOpId ? { field_id: defaultOpId } : { constant_value: 0 };
    setFormulaTerms(prev => [...prev, { op: 'add' }, newTerm]);
  };

  const removeFormulaOperandPair = (index: number) => {
    setFormulaTerms(prev => {
      if (prev.length <= 1) return prev;
      const next = [...prev];
      if (index === 0) {
        next.splice(0, 2);
      } else if (index % 2 === 0) {
        next.splice(index - 1, 2);
      } else {
        next.splice(index, 2);
      }
      return next;
    });
  };

  const updateTermFieldId = (index: number, fieldId: number) => {
    setFormulaTerms(prev => prev.map((t, i) => i === index ? { field_id: fieldId } : t));
  };

  const updateTermConstantVal = (index: number, val: number) => {
    setFormulaTerms(prev => prev.map((t, i) => i === index ? { constant_value: val } : t));
  };

  const toggleTermType = (index: number, isConstant: boolean) => {
    setFormulaTerms(prev => prev.map((t, i) => {
      if (i !== index) return t;
      if (isConstant) return { constant_value: 0 };
      const defaultOpId = eligibleOperands[0]?.id ?? 0;
      return { field_id: defaultOpId };
    }));
  };

  const updateTermOp = (index: number, op: FormulaOp) => {
    setFormulaTerms(prev => prev.map((t, i) => i === index ? { op } : t));
  };

  const submit = async () => {
    if (!label.trim()) return setError('A field label is required.');
    setSaving(true); setError('');

    let config: Record<string, any> = {};

    if (type === 'computed') {
      if (formulaTerms.length === 0 || formulaTerms.length % 2 !== 1) {
        setSaving(false);
        return setError('Formula must contain at least one operand.');
      }
      for (let i = 0; i < formulaTerms.length; i += 2) {
        const term = formulaTerms[i];
        if ('field_id' in term && (!term.field_id || Number(term.field_id) <= 0)) {
          setSaving(false);
          return setError(`Operand term at position ${Math.floor(i / 2) + 1} must select a valid field.`);
        }
      }
      config = {
        terms: formulaTerms,
        decimal_places: Number(decimalPlaces),
      };
    } else {
      if (min !== '') config[numeric.has(type) ? 'min' : 'min_length'] = Number(min);
      if (max !== '') config[numeric.has(type) ? 'max' : 'max_length'] = Number(max);
      if (defaultValue.trim() !== '') config['default_value'] = defaultValue.trim();
      if (readOnly) config['read_only'] = true;
    }

    try {
      await onSave({
        ...(field ? {} : { form_version_id: versionId }),
        label: label.trim(),
        field_type: type,
        required: type === 'computed' ? false : required,
        section_id: sectionId,
        options: choices.has(type) ? options.filter(o => o.label.trim() && o.value.trim()) : null,
        validation_config: Object.keys(config).length ? config : null,
      });
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Could not save this field. Please try again.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Close editor" onClick={onClose} className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" />
      <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-ink bg-cream p-5 text-ink sm:p-7 shadow-hard-lg">
        <CornerBrackets active />
        <div className="mb-6 flex items-start justify-between border-b border-ink/20 pb-4">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-wider text-slate">CANVAS // FIELD CONFIG</p>
            <h2 className="mt-1 text-xl font-display font-bold text-ink uppercase">{field ? 'Edit Field' : 'Add Field'}</h2>
          </div>
          <button onClick={onClose} className="p-1 border border-ink/20 bg-white text-slate hover:text-ink cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="mb-2.5 font-mono text-[10.5px] uppercase tracking-wider text-slate">FIELD TYPE</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {types.map(item => {
            const active = type === item;
            return (
              <button
                key={item}
                onClick={() => setType(item)}
                className={`flex flex-col items-center gap-1.5 p-3 text-xs font-semibold border cursor-pointer transition-colors ${
                  active
                    ? 'border-cyan bg-cyan-tint text-cyan-dark'
                    : 'border-ink/20 bg-white text-ink hover:border-cyan'
                }`}
              >
                <FieldTypeIcon type={item} className="h-6 w-6 text-cyan-dark" />
                <span>{fieldTypeLabel(item)}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 space-y-4">
          <Input label="Label" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Your full name" required />

          {sections.length > 0 && (
            <div className="w-full space-y-1.5">
              <label className="block font-sans text-[12.5px] font-medium text-ink">
                Section
              </label>
              <div className="relative">
                <select
                  value={sectionId ?? ''}
                  onChange={e => setSectionId(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-full appearance-none border border-ink/30 bg-cream-soft px-3 py-2 text-sm text-ink outline-none focus:border-cyan-dark"
                >
                  <option value="">Ungrouped</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" />
              </div>
            </div>
          )}

          {type !== 'computed' && (
            <div className="space-y-3">
              <label className="flex cursor-pointer items-center justify-between border border-ink/25 bg-white p-3">
                <div>
                  <span className="block text-sm font-semibold text-ink">Required field</span>
                  <span className="font-mono text-[10.5px] text-slate">Respondents must complete this field</span>
                </div>
                <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} className="w-4 h-4 accent-cyan" />
              </label>
            </div>
          )}

          {type === 'computed' && (
            <div className="space-y-4 border border-ink/25 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs font-bold text-ink flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-cyan-dark" /> FORMULA BUILDER
                </p>
                <button
                  type="button"
                  onClick={addFormulaOperand}
                  className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-wide text-cyan-dark hover:underline cursor-pointer bg-transparent border-none"
                >
                  <Plus className="w-3.5 h-3.5" /> Add term
                </button>
              </div>

              <div className="space-y-2">
                {formulaTerms.map((term, index) => {
                  const isOp = index % 2 === 1;
                  const isConst = 'constant_value' in term;

                  if (isOp) {
                    return (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-32">
                          <select
                            value={('op' in term) ? term.op : 'add'}
                            onChange={e => updateTermOp(index, e.target.value as FormulaOp)}
                            className="w-full border border-ink/30 bg-cream-soft px-2 py-1.5 text-xs font-semibold text-ink outline-none"
                          >
                            <option value="add">+ Add</option>
                            <option value="subtract">- Subtract</option>
                            <option value="multiply">× Multiply</option>
                            <option value="divide">÷ Divide</option>
                          </select>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-28">
                        <select
                          value={isConst ? 'constant' : 'field'}
                          onChange={e => toggleTermType(index, e.target.value === 'constant')}
                          className="w-full border border-ink/30 bg-cream-soft px-2 py-1.5 text-xs font-mono text-ink outline-none"
                        >
                          <option value="field">Field</option>
                          <option value="constant">Constant</option>
                        </select>
                      </div>

                      <div className="flex-1">
                        {isConst ? (
                          <input
                            type="number"
                            value={String(('constant_value' in term) ? term.constant_value : 0)}
                            onChange={e => updateTermConstantVal(index, Number(e.target.value))}
                            placeholder="e.g. 250"
                            className="w-full border border-ink/30 bg-cream-soft px-3 py-1.5 text-xs font-mono text-ink outline-none"
                          />
                        ) : (
                          <select
                            value={('field_id' in term) ? term.field_id : ''}
                            onChange={e => updateTermFieldId(index, Number(e.target.value))}
                            className="w-full border border-ink/30 bg-cream-soft px-3 py-1.5 text-xs text-ink outline-none focus:border-cyan-dark"
                          >
                            <option value="">Select field...</option>
                            {eligibleOperands.map(op => (
                              <option key={op.id} value={op.id}>{op.label} ({op.field_type})</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {formulaTerms.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeFormulaOperandPair(index)}
                          className="p-1 text-slate hover:text-danger cursor-pointer bg-transparent border-none"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-2">
                <Input
                  label="Decimal Places (0-10)"
                  type="number"
                  min="0"
                  max="10"
                  value={String(decimalPlaces)}
                  onChange={e => setDecimalPlaces(Math.min(10, Math.max(0, Number(e.target.value))))}
                />
              </div>
            </div>
          )}

          {field && (
            <div className="border border-ink/25 bg-white p-3 flex items-center justify-between">
              <div>
                <p className="font-sans text-xs font-semibold text-ink flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-cyan-dark" /> Conditional Rules
                </p>
                <p className="font-mono text-[10.5px] text-slate">
                  AND/OR logic rules for field visibility
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowConditionDrawer(true)}
              >
                Manage
              </Button>
            </div>
          )}

          {choices.has(type) && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[10.5px] uppercase tracking-wider text-slate">OPTIONS</p>
                <button
                  type="button"
                  onClick={() => setOptions([...options, { label: `Option ${options.length + 1}`, value: `option_${options.length + 1}` }])}
                  className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-wide text-cyan-dark hover:underline cursor-pointer bg-transparent border-none"
                >
                  <Plus className="w-3.5 h-3.5" /> Add option
                </button>
              </div>
              {options.map((option, index) => (
                <div key={index} className="mb-2 flex gap-2">
                  <input
                    value={option.label}
                    onChange={e => setOptions(options.map((item, i) => i === index ? { ...item, label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') } : item))}
                    className="min-w-0 flex-1 border border-ink/30 bg-cream-soft px-3 py-1.5 text-xs text-ink outline-none focus:border-cyan-dark"
                  />
                  <button
                    type="button"
                    onClick={() => setOptions(options.filter((_, i) => i !== index))}
                    className="p-1.5 text-slate hover:text-danger cursor-pointer bg-transparent border-none"
                  >
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
        <div className="mt-6 border border-ink/25 bg-white p-4">
          <p className="mb-3 font-mono text-[10.5px] uppercase tracking-wider text-slate">SAMPLE · CANVAS PREVIEW</p>
          <label className="mb-1.5 block text-sm font-semibold text-ink">
            {label || 'Untitled field'} {required && <span className="text-cyan-dark">*</span>}
          </label>
          {type === 'dropdown' ? (
            <select className="w-full border border-ink/30 bg-cream-soft p-2 text-sm text-ink">
              {options.map(o => <option key={o.value}>{o.label}</option>)}
            </select>
          ) : type === 'checkbox' ? (
            <div className="space-y-2">
              {options.map(o => (
                <label key={o.value} className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" className="accent-cyan" /> {o.label}
                </label>
              ))}
            </div>
          ) : type === 'rating' ? (
            <div className="flex gap-1 text-cyan-dark">
              {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-5 h-5 fill-cyan/20" />)}
            </div>
          ) : type === 'file_upload' ? (
            <div className="border border-dashed border-ink/40 bg-cream-soft p-4 text-center text-xs text-slate font-mono">
              Drop a file or click to browse
            </div>
          ) : type === 'computed' ? (
            <div className="w-full border border-cyan/40 bg-cyan-tint p-2.5 font-mono text-sm text-cyan-dark font-bold">
              [Calculated live value]
            </div>
          ) : (
            <input
              type={type}
              readOnly={readOnly}
              placeholder="Your answer"
              value={defaultValue || ''}
              className={`w-full border border-ink/30 bg-cream-soft p-2 text-sm text-ink ${readOnly ? 'bg-slate/10 font-bold' : ''}`}
            />
          )}
        </div>

        {error && <p className="mt-3 font-mono text-[10.5px] text-danger">{error}</p>}
        <div className="mt-auto flex justify-end gap-2.5 pt-6 border-t border-ink/20">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button isLoading={saving} onClick={submit}><Check className="mr-1 w-4 h-4" />Save field</Button>
        </div>
      </aside>

      {showConditionDrawer && field && (
        <ConditionGroupDrawer
          targetField={field}
          versionId={versionId}
          fields={allFields.length > 0 ? allFields : (field ? [field] : [])}
          onClose={() => setShowConditionDrawer(false)}
        />
      )}
    </div>
  );
};

export default FieldEditorDrawer;

import React from 'react';
import {
  AiFormGenerationResult,
  AiGeneratedSection,
  AiGeneratedField,
  AiFieldOption,
  AiFieldTypeForGeneration,
} from '@/types/aiForm';
import { Sparkles, Plus, Trash2, Tag, CheckSquare, ListFilter, Calendar, Mail, Hash, Type, UploadCloud, Star } from 'lucide-react';

interface GeneratedFormPreviewProps {
  draft: AiFormGenerationResult;
  onChange: (updated: AiFormGenerationResult) => void;
  readOnly?: boolean;
}

const FIELD_TYPE_ICONS: Record<AiFieldTypeForGeneration, React.ElementType> = {
  text: Type,
  number: Hash,
  email: Mail,
  date: Calendar,
  dropdown: ListFilter,
  checkbox: CheckSquare,
  file_upload: UploadCloud,
  rating: Star,
};

const CHOICE_TYPES: AiFieldTypeForGeneration[] = ['dropdown', 'checkbox'];

export const GeneratedFormPreview: React.FC<GeneratedFormPreviewProps> = ({
  draft,
  onChange,
  readOnly = false,
}) => {
  const updateTitle = (newTitle: string) => {
    onChange({ ...draft, title: newTitle });
  };

  const updateDescription = (newDesc: string) => {
    onChange({ ...draft, description: newDesc });
  };

  const updateField = (
    sectionIndex: number,
    fieldIndex: number,
    updatedField: AiGeneratedField
  ) => {
    const newSections = draft.sections.map((sec, sIdx) => {
      if (sIdx !== sectionIndex) return sec;
      const newFields = sec.fields.map((fld, fIdx) => {
        if (fIdx !== fieldIndex) return fld;
        return updatedField;
      });
      return { ...sec, fields: newFields };
    });
    onChange({ ...draft, sections: newSections });
  };

  const addOption = (sectionIndex: number, fieldIndex: number) => {
    const field = draft.sections[sectionIndex].fields[fieldIndex];
    const currentOptions = field.options || [];
    const nextNum = currentOptions.length + 1;
    const newOption: AiFieldOption = {
      label: `Option ${nextNum}`,
      value: `option_${nextNum}`,
    };
    updateField(sectionIndex, fieldIndex, {
      ...field,
      options: [...currentOptions, newOption],
    });
  };

  const updateOption = (
    sectionIndex: number,
    fieldIndex: number,
    optionIndex: number,
    label: string,
    value: string
  ) => {
    const field = draft.sections[sectionIndex].fields[fieldIndex];
    const currentOptions = field.options || [];
    const newOptions = currentOptions.map((opt, oIdx) => {
      if (oIdx !== optionIndex) return opt;
      return { label, value };
    });
    updateField(sectionIndex, fieldIndex, {
      ...field,
      options: newOptions,
    });
  };

  const removeOption = (
    sectionIndex: number,
    fieldIndex: number,
    optionIndex: number
  ) => {
    const field = draft.sections[sectionIndex].fields[fieldIndex];
    const currentOptions = field.options || [];
    const newOptions = currentOptions.filter((_, oIdx) => oIdx !== optionIndex);
    updateField(sectionIndex, fieldIndex, {
      ...field,
      options: newOptions,
    });
  };

  return (
    <div className="space-y-6">
      {/* Form Title & Description Card */}
      <div className="p-6 bg-paper-surface border border-paper-border rounded-xl shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1">
            Form Title
          </label>
          {readOnly ? (
            <h2 className="text-2xl font-serif font-bold text-ink">{draft.title}</h2>
          ) : (
            <input
              type="text"
              value={draft.title}
              onChange={(e) => updateTitle(e.target.value)}
              className="w-full px-3 py-2 text-xl font-serif font-bold text-ink bg-paper-base border border-paper-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Form Title"
            />
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1">
            Form Description
          </label>
          {readOnly ? (
            <p className="text-sm text-ink-muted">{draft.description || 'No description provided.'}</p>
          ) : (
            <textarea
              value={draft.description || ''}
              onChange={(e) => updateDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm text-ink bg-paper-base border border-paper-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              placeholder="Form Description (optional)"
            />
          )}
        </div>
      </div>

      {/* Sections and Fields List */}
      {draft.sections.map((section, sIdx) => (
        <div
          key={sIdx}
          className="bg-paper-surface border border-paper-border rounded-xl shadow-sm overflow-hidden"
        >
          {/* Section Header */}
          <div className="bg-paper-base/50 px-6 py-4 border-b border-paper-border flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                Section {sIdx + 1}
              </span>
              <h3 className="text-lg font-serif font-semibold text-ink">{section.title}</h3>
              {section.description && (
                <p className="text-xs text-ink-muted mt-0.5">{section.description}</p>
              )}
            </div>
            <span className="text-xs text-ink-muted bg-paper-base px-2.5 py-1 rounded-full border border-paper-border">
              {section.fields.length} {section.fields.length === 1 ? 'field' : 'fields'}
            </span>
          </div>

          {/* Fields List */}
          <div className="p-6 space-y-5 divide-y divide-paper-border/60">
            {section.fields.map((field, fIdx) => {
              const Icon = FIELD_TYPE_ICONS[field.field_type] || Type;
              const isChoiceType = CHOICE_TYPES.includes(field.field_type);

              return (
                <div key={fIdx} className={fIdx > 0 ? 'pt-5 space-y-3' : 'space-y-3'}>
                  {/* Field Header info row */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-paper-base text-ink-muted border border-paper-border rounded-md">
                        <Icon size={13} className="text-accent" />
                        <span className="capitalize">{field.field_type.replace('_', ' ')}</span>
                      </span>

                      {field.required && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 rounded">
                          Required
                        </span>
                      )}
                    </div>

                    {!readOnly && (
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-ink-muted hover:text-ink">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) =>
                            updateField(sIdx, fIdx, { ...field, required: e.target.checked })
                          }
                          className="rounded border-paper-border text-accent focus:ring-accent"
                        />
                        <span>Required field</span>
                      </label>
                    )}
                  </div>

                  {/* Field Inputs */}
                  {readOnly ? (
                    <div>
                      <p className="text-sm font-medium text-ink">{field.label}</p>
                      {field.placeholder && (
                        <p className="text-xs text-ink-muted italic mt-0.5">
                          Placeholder: {field.placeholder}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-ink-muted mb-1">
                          Field Label
                        </label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) =>
                            updateField(sIdx, fIdx, { ...field, label: e.target.value })
                          }
                          className="w-full px-3 py-1.5 text-sm text-ink bg-paper-base border border-paper-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="Label"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-ink-muted mb-1">
                          Placeholder Text
                        </label>
                        <input
                          type="text"
                          value={field.placeholder || ''}
                          onChange={(e) =>
                            updateField(sIdx, fIdx, {
                              ...field,
                              placeholder: e.target.value || null,
                            })
                          }
                          className="w-full px-3 py-1.5 text-sm text-ink bg-paper-base border border-paper-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="Placeholder (optional)"
                        />
                      </div>
                    </div>
                  )}

                  {/* Options editor for choice types */}
                  {isChoiceType && (
                    <div className="mt-3 pl-3 border-l-2 border-paper-border space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                          Options
                        </span>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => addOption(sIdx, fIdx)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                          >
                            <Plus size={13} /> Add Option
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        {(field.options || []).map((opt, oIdx) => (
                          <div key={oIdx} className="flex items-center gap-2">
                            {readOnly ? (
                              <span className="text-xs text-ink bg-paper-base px-2.5 py-1 rounded border border-paper-border">
                                {opt.label}
                              </span>
                            ) : (
                              <>
                                <input
                                  type="text"
                                  value={opt.label}
                                  onChange={(e) =>
                                    updateOption(
                                      sIdx,
                                      fIdx,
                                      oIdx,
                                      e.target.value,
                                      e.target.value.toLowerCase().replace(/\s+/g, '_')
                                    )
                                  }
                                  placeholder="Option Label"
                                  className="flex-1 px-2.5 py-1 text-xs text-ink bg-paper-base border border-paper-border rounded focus:outline-none focus:ring-1 focus:ring-accent"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeOption(sIdx, fIdx, oIdx)}
                                  className="text-ink-muted hover:text-red-500 p-1"
                                  title="Remove option"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        ))}
                        {(!field.options || field.options.length === 0) && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                            No options defined yet. At least one option is required.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AI Rationale caption */}
                  {field.ai_rationale && (
                    <div className="flex items-start gap-1.5 pt-1 text-xs text-ink-muted/80 bg-paper-base/40 p-2 rounded border border-paper-border/40">
                      <Sparkles size={13} className="text-accent shrink-0 mt-0.5" />
                      <span>
                        <strong className="font-semibold text-ink-muted">AI Rationale:</strong>{' '}
                        {field.ai_rationale}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

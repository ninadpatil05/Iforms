import React, { useEffect, useState } from 'react';
import {
  X,
  Trash2,
  GripVertical,
  Plus,
  ArrowRight,
  GitBranch,
} from 'lucide-react';
import { Button } from './Button';
import { Select } from './Select';
import { Input } from './Input';
import {
  createBranchRule,
  deleteBranchRule,
  listRulesForSection,
  reorderBranchRules,
  updateBranchRule,
} from '@/api/branchRules';
import type {
  BranchOperator,
  BranchRule,
  BranchRuleCreatePayload,
} from '@/types/branchRule';
import type { Field } from '@/types/field';
import type { Section } from '@/types/section';
import { RULE_OPERATORS, operatorNeedsValue } from '@/types/ruleOperators';
import { useToast } from '@/context/ToastContext';

export interface BranchRuleDrawerProps {
  section: Section;
  sections: Section[];
  fields: Field[];
  onClose: () => void;
  onUpdateDefaultNext: (defaultNextSectionId: number | null) => Promise<void>;
}

export const BranchRuleDrawer: React.FC<BranchRuleDrawerProps> = ({
  section,
  sections,
  fields,
  onClose,
  onUpdateDefaultNext,
}) => {
  const toast = useToast();
  const [rules, setRules] = useState<BranchRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [defaultNextId, setDefaultNextId] = useState<number | null>(
    section.default_next_section_id ?? null
  );

  const [saving, setSaving] = useState(false);
  const targetSections = sections.filter((s) => s.id !== section.id);

  const loadRules = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listRulesForSection(section.id);
      setRules(data);
    } catch {
      setError('Could not load branch rules for this section.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, [section.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleAddCondition = async () => {
    if (fields.length === 0) return;
    const defaultField = fields[0];
    const defaultTarget = targetSections[0]?.id || null;

    try {
      const newRule = await createBranchRule({
        from_section_id: section.id,
        to_section_id: defaultTarget,
        trigger_field_id: defaultField.id,
        operator: 'equals',
        comparison_value: 'Sales',
        priority: rules.length,
      });

      setRules((prev) => [...prev, newRule]);
      toast.success('Branch rule added', 'Configured new jump condition.');
    } catch {
      toast.error('Add rule failed', 'Could not create branch rule.');
    }
  };

  const handleUpdateRule = async (ruleId: number, updates: Partial<BranchRule>) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, ...updates } : r))
    );

    try {
      const updated = await updateBranchRule(ruleId, updates);
      setRules((prev) => prev.map((r) => (r.id === ruleId ? updated : r)));
    } catch {
      toast.error('Update rule failed', 'Could not save rule updates.');
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    try {
      await deleteBranchRule(ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      toast.info('Rule removed', 'Branch condition deleted.');
    } catch {
      toast.error('Delete rule failed', 'Could not remove rule.');
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await onUpdateDefaultNext(defaultNextId);
      toast.success('Branch logic saved', 'Updated routing rules for section.');
      onClose();
    } catch {
      toast.error('Save failed', 'Could not save branch logic settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel matching branching_logic_drawer_updated screenshot */}
      <div className="relative z-10 w-full max-w-md bg-paper-lowest border-l border-paper-border h-full flex flex-col justify-between p-6 shadow-warm-lift overflow-y-auto">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-paper-border pb-4">
            <div>
              <h2 className="font-serif text-2xl font-bold text-ink">Branch Logic</h2>
              <p className="text-xs text-ink-muted mt-1 font-sans">
                From: <span className="text-ink font-semibold">{section.title}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-ink-muted hover:text-ink rounded-sm transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {error && (
            <div className="p-3 bg-brick-container border border-brick-border text-brick text-xs font-medium rounded-sm">
              {error}
            </div>
          )}

          {/* Rule Cards List */}
          <div className="space-y-4">
            {loading ? (
              <div className="py-4 text-center text-xs text-ink-muted italic">Loading rules...</div>
            ) : rules.length === 0 ? (
              <div className="p-4 bg-paper-high/40 border border-paper-border rounded-md text-center text-xs text-ink-muted">
                No branch rules set yet. All respondents follow the fallback action.
              </div>
            ) : (
              rules.map((rule, idx) => (
                <div
                  key={rule.id}
                  className="p-4 bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm space-y-3 relative group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical size={14} className="text-ink-subtle cursor-grab" />
                      <span className="text-xs font-mono font-bold text-ink-muted uppercase">
                        RULE {idx + 1}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1 text-ink-muted hover:text-brick cursor-pointer"
                      title="Delete Rule"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* IF Field Dropdown */}
                  <div className="flex items-center gap-3">
                    <span className="w-12 text-xs font-bold text-ink uppercase">IF</span>
                    <div className="flex-1">
                      <Select
                        options={fields.map((f) => ({ value: String(f.id), label: f.label }))}
                        value={String(rule.trigger_field_id)}
                        onChange={(val) => handleUpdateRule(rule.id, { trigger_field_id: Number(val) })}
                        searchable={false}
                        clearable={false}
                      />
                    </div>
                  </div>

                  {/* IS Value Input/Dropdown */}
                  <div className="flex items-center gap-3">
                    <span className="w-12 text-xs font-bold text-ink uppercase">IS</span>
                    <div className="flex-1">
                      <Input
                        value={rule.comparison_value || ''}
                        onChange={(e) => handleUpdateRule(rule.id, { comparison_value: e.target.value })}
                        placeholder="Value..."
                      />
                    </div>
                  </div>

                  {/* JUMP Target Section Dropdown */}
                  <div className="flex items-center gap-3 pt-1 border-t border-paper-border">
                    <span className="w-12 text-xs font-bold text-terracotta uppercase">JUMP</span>
                    <div className="flex-1">
                      <Select
                        options={[
                          ...targetSections.map((s) => ({ value: String(s.id), label: s.title })),
                          { value: 'end', label: 'End of Form' },
                        ]}
                        value={rule.to_section_id ? String(rule.to_section_id) : 'end'}
                        onChange={(val) =>
                          handleUpdateRule(rule.id, {
                            to_section_id: val === 'end' ? null : Number(val),
                          })
                        }
                        searchable={false}
                        clearable={false}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Add Condition CTA Box matching reference screenshot */}
            <button
              type="button"
              onClick={handleAddCondition}
              className="w-full py-3 bg-paper-lowest border border-dashed border-paper-border hover:border-terracotta rounded-md flex items-center justify-center gap-2 text-xs font-semibold text-ink hover:text-terracotta transition-colors shadow-warm-sm cursor-pointer"
            >
              <Plus size={16} />
              <span>Add Condition</span>
            </button>
          </div>

          {/* FALLBACK ACTION Section matching reference screenshot */}
          <div className="space-y-3 pt-4 border-t border-paper-border">
            <h4 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
              FALLBACK ACTION
            </h4>

            <div className="flex items-center gap-3">
              <span className="w-12 text-xs font-bold text-ink uppercase">ELSE</span>
              <div className="flex-1">
                <Select
                  options={[
                    { value: '', label: 'Continue to Next Section' },
                    ...targetSections.map((s) => ({
                      value: String(s.id),
                      label: `Go to: ${s.title}`,
                    })),
                  ]}
                  value={defaultNextId ? String(defaultNextId) : ''}
                  onChange={(val) => setDefaultNextId(val ? Number(val) : null)}
                  searchable={false}
                  clearable={false}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-paper-border flex items-center justify-end gap-3 mt-6">
          <Button variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            isLoading={saving}
            onClick={handleSaveAll}
          >
            Save Rules
          </Button>
        </div>
      </div>
    </div>
  );
};

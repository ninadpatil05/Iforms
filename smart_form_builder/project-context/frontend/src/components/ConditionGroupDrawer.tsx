import React, { useEffect, useState } from 'react';
import {
  Check,
  Plus,
  Trash2,
  X,
  Eye,
  EyeOff,
  Lock,
  ArrowDown,
  AlertCircle,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { ComparisonValueInput } from './ComparisonValueInput';
import {
  createConditionGroup,
  deleteConditionGroup,
  listGroupsForVersion,
  updateConditionGroup,
} from '@/api/conditionGroups';
import type {
  ConditionGroup,
  ConditionGroupConditionCreatePayload,
  GroupAction,
  GroupCombinator,
} from '@/types/conditionGroup';
import type { Field } from '@/types/field';
import type { BranchOperator } from '@/types/branchRule';
import { RULE_OPERATORS, operatorNeedsValue } from '@/types/ruleOperators';

export interface ConditionGroupDrawerProps {
  targetField: Field;
  versionId: number;
  fields: Field[];
  activeTab?: 'logic' | 'settings' | 'theme';
  onTabChange?: (tab: 'logic' | 'settings' | 'theme') => void;
  onClose: () => void;
}

export const ConditionGroupDrawer: React.FC<ConditionGroupDrawerProps> = ({
  targetField,
  versionId,
  fields,
  activeTab = 'logic',
  onTabChange,
  onClose,
}) => {
  const [groups, setGroups] = useState<ConditionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [action, setAction] = useState<GroupAction>('show');
  const [combinator, setCombinator] = useState<GroupCombinator>('AND');

  const otherFields = fields.filter((f) => f.id !== targetField.id);
  const defaultTriggerId = otherFields[0]?.id || fields[0]?.id || 0;

  const [conditions, setConditions] = useState<ConditionGroupConditionCreatePayload[]>([
    {
      trigger_field_id: defaultTriggerId,
      operator: 'equals',
      comparison_value: '',
    },
  ]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadGroups = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listGroupsForVersion(versionId);
      setGroups(data.filter((g) => g.target_field_id === targetField.id));
    } catch {
      setError('Could not load visibility rules for this field.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, [versionId, targetField.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleAddConditionRow = () => {
    setConditions((prev) => [
      ...prev,
      {
        trigger_field_id: defaultTriggerId,
        operator: 'equals',
        comparison_value: '',
      },
    ]);
  };

  const handleRemoveConditionRow = (index: number) => {
    if (conditions.length <= 1) return;
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateConditionRow = (
    index: number,
    key: keyof ConditionGroupConditionCreatePayload,
    val: any
  ) => {
    setConditions((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [key]: val } : item))
    );
  };

  const handleSaveGroup = async () => {
    if (conditions.length === 0) {
      setFormError('Rule group must have at least one condition.');
      return;
    }
    setSaving(true);
    setFormError('');

    try {
      const payloadConditions = conditions.map((c) => ({
        trigger_field_id: c.trigger_field_id,
        operator: c.operator,
        comparison_value: operatorNeedsValue(c.operator) ? c.comparison_value : null,
      }));

      if (editingGroupId) {
        await updateConditionGroup(editingGroupId, {
          action,
          combinator,
          conditions: payloadConditions,
        });
      } else {
        await createConditionGroup({
          form_version_id: versionId,
          target_field_id: targetField.id,
          action,
          combinator,
          conditions: payloadConditions,
        });
      }

      setEditingGroupId(null);
      setConditions([
        {
          trigger_field_id: defaultTriggerId,
          operator: 'equals',
          comparison_value: '',
        },
      ]);
      await loadGroups();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setFormError(msg || 'Could not save visibility rule group.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    try {
      await deleteConditionGroup(groupId);
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
    } catch {
      setError('Could not delete rule group.');
    }
  };

  const getFieldLabel = (fId: number) => fields.find((f) => f.id === fId)?.label ?? `Field ${fId}`;

  return (
    <div className="w-80 bg-paper-lowest border-l border-paper-border flex flex-col h-full overflow-y-auto p-5 space-y-6 shadow-warm-lift">
      {/* Top Header Badge */}
      <div className="flex items-center gap-3 border-b border-paper-border pb-4">
        <div className="w-9 h-9 rounded-full bg-terracotta text-white font-serif font-bold text-sm flex items-center justify-center shadow-warm-sm">
          UW
        </div>
        <div>
          <h4 className="font-serif font-bold text-sm text-ink">Form Editor</h4>
          <p className="text-[11px] text-ink-muted">Drafting Contact Form</p>
        </div>
        <button
          onClick={onClose}
          className="ml-auto text-ink-muted hover:text-ink p-1 rounded-sm cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Navigation Sub-Tabs matching reference screenshot */}
      <div className="flex border-b border-paper-border text-xs font-medium">
        <button
          type="button"
          onClick={() => onTabChange && onTabChange('logic')}
          className={`flex-1 py-2 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === 'logic'
              ? 'border-terracotta text-terracotta font-semibold'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <Sliders size={14} />
          <span>Logic</span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange && onTabChange('settings')}
          className={`flex-1 py-2 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === 'settings'
              ? 'border-terracotta text-terracotta font-semibold'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <Sliders size={14} />
          <span>Settings</span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange && onTabChange('theme')}
          className={`flex-1 py-2 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === 'theme'
              ? 'border-terracotta text-terracotta font-semibold'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <Sparkles size={14} />
          <span>Theme</span>
        </button>
      </div>

      {/* Section Title */}
      <div>
        <h3 className="font-serif text-lg font-bold text-ink tracking-tight">Field Logic</h3>
        <p className="text-xs text-ink-muted mt-1 leading-relaxed">
          Control visibility and behavior based on user input.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-sm bg-brick-container border border-brick-border text-brick text-xs font-medium">
          {error}
        </div>
      )}

      {/* Existing Rules List Cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-4 text-center text-xs text-ink-muted italic">Loading rules...</div>
        ) : groups.length === 0 ? (
          <div className="p-4 rounded-sm border border-dashed border-paper-border text-center text-xs text-ink-muted italic">
            No rules configured yet for "{targetField.label}".
          </div>
        ) : (
          groups.map((group, gIdx) => (
            <div
              key={group.id}
              className="p-4 bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm space-y-3 relative group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-terracotta uppercase">
                  RULE {gIdx + 1}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDeleteGroup(group.id)}
                    className="p-1 text-ink-muted hover:text-brick cursor-pointer"
                    title="Delete Rule"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Rule Visual Flow matching screenshot */}
              <div className="space-y-2 text-xs">
                {group.conditions.map((cond, cIdx) => (
                  <div key={cIdx} className="p-2 bg-terracotta-fixed/60 border border-terracotta/20 rounded-sm">
                    <span className="font-bold text-ink">IF </span>
                    <span className="text-terracotta font-medium">{getFieldLabel(cond.trigger_field_id)}</span>{' '}
                    <span>is </span>
                    <strong className="text-ink">"{cond.comparison_value || 'Value'}"</strong>
                  </div>
                ))}

                <div className="flex justify-center text-ink-subtle">
                  <ArrowDown size={14} />
                </div>

                <div className="p-2 bg-paper-high/60 border border-paper-border rounded-sm">
                  <span className="font-bold text-ink">THEN {group.action === 'show' ? 'Show' : group.action === 'hide' ? 'Hide' : 'Require'} </span>
                  <span className="text-terracotta font-medium">{targetField.label}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Rule Builder Section matching reference screenshot */}
      <div className="p-4 bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm space-y-4">
        <div className="flex items-center gap-1.5 font-bold text-xs text-ink uppercase tracking-wider">
          <Plus size={14} className="text-terracotta" />
          <span>New Rule</span>
        </div>

        {/* IF Trigger Condition */}
        <div className="space-y-2">
          <label className="block text-[11px] font-semibold text-ink-muted uppercase">IF</label>

          {conditions.map((cond, idx) => (
            <div key={idx} className="space-y-2">
              <Select
                options={fields.map((f) => ({ value: String(f.id), label: f.label }))}
                value={String(cond.trigger_field_id)}
                onChange={(val) => updateConditionRow(idx, 'trigger_field_id', Number(val))}
                searchable={false}
                clearable={false}
              />

              <div className="grid grid-cols-2 gap-2">
                <Select
                  options={RULE_OPERATORS.map((op) => ({ value: op.value, label: op.label }))}
                  value={cond.operator}
                  onChange={(val) => updateConditionRow(idx, 'operator', val as BranchOperator)}
                  searchable={false}
                  clearable={false}
                />
                <Input
                  placeholder="Value..."
                  value={cond.comparison_value || ''}
                  onChange={(e) => updateConditionRow(idx, 'comparison_value', e.target.value)}
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={handleAddConditionRow}
            className="text-xs text-terracotta font-semibold hover:underline bg-transparent border-none cursor-pointer pt-1"
          >
            + Add AND / OR condition
          </button>
        </div>

        {/* THEN Action */}
        <div className="space-y-2 pt-2 border-t border-paper-border">
          <label className="block text-[11px] font-semibold text-ink-muted uppercase">THEN</label>

          <div className="grid grid-cols-2 gap-2">
            <Select
              options={[
                { value: 'show', label: 'Show' },
                { value: 'hide', label: 'Hide' },
                { value: 'require', label: 'Require' },
              ]}
              value={action}
              onChange={(val) => setAction(val as GroupAction)}
              searchable={false}
              clearable={false}
            />
            <Input value={targetField.label} readOnly className="bg-paper-high text-ink-muted" />
          </div>
        </div>

        {formError && <p className="text-xs text-brick font-medium">{formError}</p>}

        <Button
          type="button"
          variant="primary"
          fullWidth
          size="sm"
          isLoading={saving}
          onClick={handleSaveGroup}
        >
          Save Rule
        </Button>
      </div>
    </div>
  );
};

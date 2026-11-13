import React, { useState, useEffect } from 'react';
import { Form, DuplicatePolicy } from '@/types/form';
import { Field } from '@/types/field';
import { updateForm } from '@/api/forms';
import { getCurrentVersion, listFields } from '@/api/fields';
import { getPublishedFormLink } from '@/api/forms';
import { Button } from '@/components/Button';
import { Calendar, Clock, ShieldAlert, Check } from 'lucide-react';

interface FormScheduleDuplicateSettingsProps {
  form: Form;
  onUpdate: (updated: Form) => void;
  onError?: (msg: string) => void;
}

const toDatetimeLocal = (isoStr: string | null | undefined): string => {
  if (!isoStr) return '';
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const fromDatetimeLocal = (localStr: string): string | null => {
  if (!localStr) return null;
  const date = new Date(localStr);
  return isNaN(date.getTime()) ? null : date.toISOString();
};

export const FormScheduleDuplicateSettings: React.FC<FormScheduleDuplicateSettingsProps> = ({
  form,
  onUpdate,
  onError,
}) => {
  // Scheduling state
  const [noStartRestriction, setNoStartRestriction] = useState<boolean>(!form.starts_at);
  const [unlimitedEndTime, setUnlimitedEndTime] = useState<boolean>(!form.ends_at);
  const [startsAtLocal, setStartsAtLocal] = useState<string>(toDatetimeLocal(form.starts_at));
  const [endsAtLocal, setEndsAtLocal] = useState<string>(toDatetimeLocal(form.ends_at));

  // Duplicate state
  const [duplicatePolicy, setDuplicatePolicy] = useState<DuplicatePolicy>(
    form.duplicate_policy || 'allow'
  );
  const [duplicateCheckFieldId, setDuplicateCheckFieldId] = useState<number | null>(
    form.duplicate_check_field_id
  );

  const [fields, setFields] = useState<Field[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync state when form prop changes
  useEffect(() => {
    setNoStartRestriction(!form.starts_at);
    setUnlimitedEndTime(!form.ends_at);
    setStartsAtLocal(toDatetimeLocal(form.starts_at));
    setEndsAtLocal(toDatetimeLocal(form.ends_at));
    setDuplicatePolicy(form.duplicate_policy || 'allow');
    setDuplicateCheckFieldId(form.duplicate_check_field_id);
  }, [form]);

  // Load fields for duplicate check picker
  useEffect(() => {
    let isMounted = true;
    const fetchFields = async () => {
      setIsLoadingFields(true);
      try {
        let vId: number;
        try {
          const pubLink = await getPublishedFormLink(form.id);
          vId = pubLink.form_version_id;
        } catch {
          const draft = await getCurrentVersion(form.id);
          vId = draft.id;
        }
        const loadedFields = await listFields(vId);
        if (isMounted) {
          setFields(loadedFields);
        }
      } catch {
        if (isMounted) setFields([]);
      } finally {
        if (isMounted) setIsLoadingFields(false);
      }
    };
    fetchFields();
    return () => {
      isMounted = false;
    };
  }, [form.id]);

  // Calculate schedule duration note
  const getWindowNote = (): string | null => {
    if (noStartRestriction || unlimitedEndTime || !startsAtLocal || !endsAtLocal) return null;
    const start = new Date(startsAtLocal);
    const end = new Date(endsAtLocal);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return 'Warning: Closes at time must be after Opens at time.';

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    const remHours = diffHours % 24;

    if (diffDays > 0) {
      return `Schedule active for ${diffDays} day${diffDays > 1 ? 's' : ''}${
        remHours > 0 ? ` and ${remHours} hour${remHours > 1 ? 's' : ''}` : ''
      }.`;
    }
    return `Schedule active for ${diffHours} hour${diffHours > 1 ? 's' : ''}.`;
  };

  const handleSaveSettings = async () => {
    setValidationError(null);

    const startsAtVal = noStartRestriction ? null : fromDatetimeLocal(startsAtLocal);
    const endsAtVal = unlimitedEndTime ? null : fromDatetimeLocal(endsAtLocal);

    if (startsAtVal && endsAtVal) {
      if (new Date(endsAtVal) <= new Date(startsAtVal)) {
        setValidationError('Closes at date/time must be after Opens at date/time.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const updated = await updateForm(form.id, {
        starts_at: startsAtVal,
        ends_at: endsAtVal,
        duplicate_policy: duplicatePolicy,
        duplicate_check_field_id: duplicatePolicy === 'allow' ? null : duplicateCheckFieldId,
      });
      onUpdate(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      if (onError) onError('Failed to update form schedule or duplicate detection settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const windowNote = getWindowNote();

  return (
    <div className="border border-ink/20 bg-cream-soft p-5 sm:p-6 space-y-6">
      {/* 1. Schedule Settings Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-ink/15 pb-2">
          <Calendar size={16} className="text-terracotta" />
          <h3 className="font-display font-bold text-sm uppercase text-ink">Form Availability Schedule</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Opens at */}
          <div className="space-y-2">
            <label className="block font-mono text-[10.5px] uppercase tracking-wider text-slate">
              Opens At (UTC)
            </label>
            <input
              type="datetime-local"
              disabled={noStartRestriction}
              value={startsAtLocal}
              onChange={(e) => setStartsAtLocal(e.target.value)}
              className="w-full border border-ink/30 bg-white px-3 py-2 text-xs font-mono text-ink disabled:opacity-50 disabled:bg-cream-soft"
            />
            <label className="flex items-center gap-2 cursor-pointer pt-0.5">
              <input
                type="checkbox"
                checked={noStartRestriction}
                onChange={(e) => {
                  setNoStartRestriction(e.target.checked);
                  if (e.target.checked) setStartsAtLocal('');
                }}
                className="accent-terracotta"
              />
              <span className="text-xs text-ink-muted">No start restriction (Open immediately)</span>
            </label>
          </div>

          {/* Closes at */}
          <div className="space-y-2">
            <label className="block font-mono text-[10.5px] uppercase tracking-wider text-slate">
              Closes At (UTC)
            </label>
            <input
              type="datetime-local"
              disabled={unlimitedEndTime}
              value={endsAtLocal}
              onChange={(e) => setEndsAtLocal(e.target.value)}
              className="w-full border border-ink/30 bg-white px-3 py-2 text-xs font-mono text-ink disabled:opacity-50 disabled:bg-cream-soft"
            />
            <label className="flex items-center gap-2 cursor-pointer pt-0.5">
              <input
                type="checkbox"
                checked={unlimitedEndTime}
                onChange={(e) => {
                  setUnlimitedEndTime(e.target.checked);
                  if (e.target.checked) setEndsAtLocal('');
                }}
                className="accent-terracotta"
              />
              <span className="text-xs text-ink-muted">Unlimited (no end time)</span>
            </label>
          </div>
        </div>

        {/* Window Note Callout */}
        {windowNote && (
          <p className="text-xs font-mono text-terracotta bg-terracotta/10 p-2.5 rounded border border-terracotta/20">
            {windowNote}
          </p>
        )}
      </div>

      {/* 2. Duplicate Response Detection Section */}
      <div className="space-y-4 pt-4 border-t border-ink/15">
        <div className="flex items-center gap-2 border-b border-ink/15 pb-2">
          <ShieldAlert size={16} className="text-terracotta" />
          <h3 className="font-display font-bold text-sm uppercase text-ink">Duplicate Response Policy</h3>
        </div>

        <div className="space-y-3">
          <label className="block font-mono text-[10.5px] uppercase tracking-wider text-slate">
            Policy Action
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['allow', 'warn', 'block'] as DuplicatePolicy[]).map((pol) => (
              <button
                key={pol}
                type="button"
                onClick={() => setDuplicatePolicy(pol)}
                className={`py-2 px-3 text-xs font-mono font-semibold uppercase border transition-colors ${
                  duplicatePolicy === pol
                    ? 'border-terracotta bg-terracotta text-white'
                    : 'border-ink/20 bg-white text-ink hover:bg-cream-soft'
                }`}
              >
                {pol}
              </button>
            ))}
          </div>

          {/* Field Selector (Hidden/disabled when policy is 'allow') */}
          {duplicatePolicy !== 'allow' && (
            <div className="space-y-2 pt-2">
              <label className="block font-mono text-[10.5px] uppercase tracking-wider text-slate">
                Check duplicates using field
              </label>
              {isLoadingFields ? (
                <p className="text-xs italic text-slate font-mono">Loading form fields…</p>
              ) : (
                <select
                  value={duplicateCheckFieldId ?? ''}
                  onChange={(e) =>
                    setDuplicateCheckFieldId(e.target.value ? Number(e.target.value) : null)
                  }
                  className="w-full border border-ink/30 bg-white px-3 py-2 text-xs font-mono text-ink outline-none focus:border-cyan-dark"
                >
                  <option value="">-- Select Field --</option>
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label} ({f.field_type})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Validation Error Banner */}
      {validationError && (
        <p className="text-xs font-mono text-danger font-semibold bg-danger/10 p-2.5 rounded border border-danger/20">
          {validationError}
        </p>
      )}

      {/* Save Button Bar */}
      <div className="flex items-center justify-between pt-2 border-t border-ink/15">
        <span className="text-xs font-mono text-slate">
          {saveSuccess && (
            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
              <Check size={14} /> Settings saved!
            </span>
          )}
        </span>
        <Button variant="primary" size="sm" onClick={handleSaveSettings} isLoading={isSaving}>
          Save Settings
        </Button>
      </div>
    </div>
  );
};

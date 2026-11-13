import React, { useState, useEffect } from 'react';
import { Form, DuplicatePolicy } from '@/types/form';
import { Field } from '@/types/field';
import { updateForm } from '@/api/forms';
import { getCurrentVersion, listFields } from '@/api/fields';
import { getPublishedFormLink } from '@/api/forms';
import { Button } from '@/components/Button';
import { Calendar, ShieldAlert, Check } from 'lucide-react';

interface FormScheduleDuplicateSettingsProps {
  form: Form;
  onUpdate: (updated: Form) => void;
  onError?: (msg: string) => void;
  section?: 'all' | 'schedule' | 'duplicate';
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
  section = 'all',
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

  const showSchedule = section === 'all' || section === 'schedule';
  const showDuplicate = section === 'all' || section === 'duplicate';

  return (
    <div className="space-y-5">
      {/* 1. Availability Schedule Section */}
      {showSchedule && (
        <div className="space-y-3 pt-2 border-t border-paper-border">
          <div className="flex items-center gap-1.5 pb-1">
            <span className="font-mono text-[10.5px] uppercase tracking-wider font-bold text-ink-muted">
              AVAILABILITY SCHEDULE
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Opens at */}
            <div className="space-y-1">
              <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                Opens At
              </label>
              <input
                type="datetime-local"
                disabled={noStartRestriction}
                value={startsAtLocal}
                onChange={(e) => setStartsAtLocal(e.target.value)}
                className="w-full border border-paper-border bg-paper-lowest px-2.5 py-1.5 text-xs font-mono text-ink rounded-sm outline-none focus:border-terracotta disabled:opacity-50 disabled:bg-paper-high"
              />
            </div>

            {/* Closes at */}
            <div className="space-y-1">
              <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                Closes At
              </label>
              <input
                type="datetime-local"
                disabled={unlimitedEndTime}
                value={endsAtLocal}
                onChange={(e) => setEndsAtLocal(e.target.value)}
                className="w-full border border-paper-border bg-paper-lowest px-2.5 py-1.5 text-xs font-mono text-ink rounded-sm outline-none focus:border-terracotta disabled:opacity-50 disabled:bg-paper-high"
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={noStartRestriction && unlimitedEndTime}
                onChange={(e) => {
                  const val = e.target.checked;
                  setNoStartRestriction(val);
                  setUnlimitedEndTime(val);
                  if (val) {
                    setStartsAtLocal('');
                    setEndsAtLocal('');
                  }
                }}
                className="accent-terracotta w-3.5 h-3.5 rounded-sm"
              />
              <span className="text-xs text-ink-muted font-sans">No time restriction</span>
            </label>
          </div>
        </div>
      )}

      {/* 2. Duplicate Response Detection Section */}
      {showDuplicate && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-muted">
              DUPLICATE RESPONSE POLICY
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['allow', 'warn', 'block'] as DuplicatePolicy[]).map((pol) => (
                <button
                  key={pol}
                  type="button"
                  onClick={() => setDuplicatePolicy(pol)}
                  className={`py-2 px-3 text-xs font-mono font-bold uppercase rounded-sm border transition-all cursor-pointer ${
                    duplicatePolicy === pol
                      ? 'border-terracotta bg-terracotta text-white shadow-warm-sm'
                      : 'border-paper-border bg-paper-lowest text-ink-muted hover:text-ink hover:bg-paper-high'
                  }`}
                >
                  {pol}
                </button>
              ))}
            </div>
          </div>

          {/* Field Selector */}
          {duplicatePolicy !== 'allow' && (
            <div className="space-y-1.5">
              <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                Unique Identifier Key
              </label>
              {isLoadingFields ? (
                <p className="text-xs italic text-ink-muted font-mono">Loading fields…</p>
              ) : (
                <select
                  value={duplicateCheckFieldId ?? ''}
                  onChange={(e) =>
                    setDuplicateCheckFieldId(e.target.value ? Number(e.target.value) : null)
                  }
                  className="w-full border border-paper-border bg-paper-lowest px-3 py-2 text-xs font-mono text-ink rounded-sm outline-none focus:border-terracotta"
                >
                  <option value="">-- Select Field --</option>
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label} (Field ID: {f.id})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Validation Error Banner */}
          {validationError && (
            <p className="text-xs font-mono text-brick font-semibold bg-brick-container/60 p-2.5 rounded-sm border border-brick-border">
              {validationError}
            </p>
          )}

          {/* Save Button */}
          <div className="pt-2">
            <Button
              variant="primary"
              size="md"
              fullWidth
              onClick={handleSaveSettings}
              isLoading={isSaving}
              className="bg-terracotta hover:bg-terracotta-hover text-white font-medium"
            >
              Save Integrity Settings
            </Button>
            {saveSuccess && (
              <p className="text-[11px] font-mono text-forest font-semibold text-center mt-2 flex items-center justify-center gap-1">
                <Check size={12} /> Settings saved successfully!
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

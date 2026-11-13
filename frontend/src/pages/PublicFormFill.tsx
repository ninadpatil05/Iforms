import React, { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Upload,
  User,
  Clock,
  ArrowRight,
  ArrowLeft,
  Check,
  Calculator,
  Lock,
  X as XIcon,
} from 'lucide-react';
import {
  getPublicForm,
  getNextPage,
  getPreviousPage,
  getSavedAnswers,
  type PublicForm,
} from '@/api/publicForms';
import {
  startSubmission,
  saveSubmissionValues,
  completeSubmission,
  requestDuplicateOverride,
  getDuplicateOverrideStatus,
} from '@/api/submissions';
import { uploadResponseFile } from '@/api/responseValues';
import { Button } from '@/components/Button';
import { InlineBanner } from '@/components/InlineBanner';
import type { Field } from '@/types/field';
import type { Section } from '@/types/section';
import { resolveFieldStates } from '@/utils/ruleEvaluation';
import { evaluateFormula } from '@/utils/formulaEvaluation';
import { useToast } from '@/context/ToastContext';

interface VisitedSection {
  id: number;
  title: string;
}

export const PublicFormFill: React.FC = () => {
  const { publicLink } = useParams<{ publicLink: string }>();
  const toast = useToast();

  const [form, setForm] = useState<PublicForm | null>(null);
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentSectionId, setCurrentSectionId] = useState<number | null>(null);
  const [visitedSections, setVisitedSections] = useState<VisitedSection[]>([]);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [files, setFiles] = useState<Record<number, File | null>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoingBack, setIsGoingBack] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // New scheduling & duplicate states
  const [scheduleState, setScheduleState] = useState<'not_yet_open' | 'closed' | null>(null);
  const [duplicateWarn, setDuplicateWarn] = useState(false);
  const [duplicateBlocked, setDuplicateBlocked] = useState(false);
  const [duplicateBlockedMessage, setDuplicateBlockedMessage] = useState('');
  const [overrideStatus, setOverrideStatus] = useState<'none' | 'pending' | 'approved' | 'denied'>('none');
  const [isRequestingOverride, setIsRequestingOverride] = useState(false);

  const pollingRef = React.useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const startPollingStatus = useCallback(
    (subId: number, token?: string) => {
      stopPolling();
      pollingRef.current = setInterval(async () => {
        try {
          const res = await getDuplicateOverrideStatus(subId);
          if (res.status === 'approved') {
            stopPolling();
            setOverrideStatus('approved');
            try {
              const resSub = await completeSubmission(subId, token);
              if ((resSub as any)?.duplicate_warning) {
                setDuplicateWarn(true);
              }
              setIsCompleted(true);
              setDuplicateBlocked(false);
            } catch {
              setError('Approval granted! Please click submit to complete your response.');
            }
          } else if (res.status === 'denied') {
            stopPolling();
            setOverrideStatus('denied');
          } else if (res.status === 'pending') {
            setOverrideStatus('pending');
          }
        } catch {
          // ignore
        }
      }, 5000);
    },
    [stopPolling]
  );

  const handleRequestOverride = async () => {
    if (!submissionId) return;
    setIsRequestingOverride(true);
    try {
      await requestDuplicateOverride(submissionId);
      setOverrideStatus('pending');
      startPollingStatus(submissionId, accessToken ?? undefined);
    } catch {
      setError('Failed to send override request. Please try again.');
    } finally {
      setIsRequestingOverride(false);
    }
  };

  const loadForm = useCallback(async () => {
    if (!publicLink) return;
    setIsLoading(true);
    setError('');
    setScheduleState(null);
    try {
      const inviteToken = new URLSearchParams(window.location.search).get('invite') || undefined;
      const publicForm = await getPublicForm(publicLink, inviteToken);
      const submission = await startSubmission(publicForm.form_version_id, inviteToken);

      setForm(publicForm);
      setSubmissionId(submission.id);
      setAccessToken(submission.access_token);
      setVisitedSections([]);

      if (publicForm.sections && publicForm.sections.length > 0) {
        setCurrentSectionId(publicForm.sections[0].id);
      } else {
        setCurrentSectionId(null);
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      if (detail === 'FORM_NOT_YET_OPEN') {
        setScheduleState('not_yet_open');
      } else if (detail === 'FORM_CLOSED') {
        setScheduleState('closed');
      } else {
        setError(
          typeof detail === 'string'
            ? detail
            : 'This form is unavailable or no longer accepting responses.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [publicLink]);

  useEffect(() => {
    loadForm();
  }, [loadForm]);

  const setAnswer = (fieldId: number, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
  };

  const hasSections = !!(form?.sections && form.sections.length > 0);

  const currentSection: Section | undefined = hasSections
    ? form?.sections.find((s) => s.id === currentSectionId) ?? form?.sections[0]
    : undefined;

  const currentSectionFields: Field[] = form
    ? hasSections
      ? form.fields.filter((f) => (f.section_id ?? null) === (currentSection?.id ?? null))
      : form.fields
    : [];

  const effectiveAnswers = useMemo(() => {
    const result = { ...answers };
    if (!form?.fields) return result;

    const computedFields = form.fields.filter((f) => f.field_type === 'computed');
    if (computedFields.length === 0) return result;

    let changed = true;
    let passes = 0;
    while (changed && passes < computedFields.length) {
      changed = false;
      passes++;
      for (const cf of computedFields) {
        const terms = cf.validation_config?.terms as any[];
        const decPlaces = typeof cf.validation_config?.decimal_places === 'number' ? cf.validation_config.decimal_places : 2;
        if (terms && Array.isArray(terms)) {
          const val = evaluateFormula(terms, result, decPlaces);
          const valStr = val !== null ? String(val) : '';
          if (result[cf.id] !== valStr) {
            result[cf.id] = valStr;
            changed = true;
          }
        }
      }
    }
    return result;
  }, [answers, form?.fields]);

  const fieldStates = useMemo(
    () => resolveFieldStates(form?.condition_groups ?? [], effectiveAnswers),
    [form?.condition_groups, effectiveAnswers]
  );

  const visibleCurrentSectionFields = useMemo(
    () => currentSectionFields.filter((f) => !fieldStates[f.id]?.hidden),
    [currentSectionFields, fieldStates]
  );

  const handleBack = async () => {
    if (!publicLink || !submissionId || !accessToken || visitedSections.length === 0) return;
    setIsGoingBack(true);
    setError('');
    try {
      const res = await getPreviousPage(publicLink, submissionId, accessToken);
      const prevId = res.previous_section_id;

      const saved = await getSavedAnswers(publicLink, submissionId, accessToken);
      const answerMap: Record<number, string | string[]> = {};
      for (const sv of saved) {
        if (sv.value_text !== null) {
          try {
            const parsed = JSON.parse(sv.value_text);
            if (Array.isArray(parsed)) {
              answerMap[sv.field_id] = parsed as string[];
              continue;
            }
          } catch {
            // Not JSON
          }
          answerMap[sv.field_id] = sv.value_text;
        }
      }
      setAnswers((prev) => ({ ...prev, ...answerMap }));
      setVisitedSections((prev) => prev.filter((s) => s.id !== prevId));
      setCurrentSectionId(prevId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('Could not navigate to previous section.');
    } finally {
      setIsGoingBack(false);
    }
  };

  // Phase 3: Build human-readable formula description from terms array
  const buildFormulaDescription = (terms: any[]): string => {
    if (!terms || !Array.isArray(terms) || !form?.fields) return '';
    const opMap: Record<string, string> = { '+': '+', '-': '-', '*': 'x', '/': '/' };
    return terms
      .map((term: any) => {
        if (term.type === 'field') {
          const f = form.fields.find((fld) => fld.id === term.field_id);
          return f ? f.label : `Field #${term.field_id}`;
        }
        if (term.type === 'constant') return String(term.value ?? '');
        if (term.type === 'operator') return opMap[String(term.value)] ?? String(term.value ?? '');
        return '';
      })
      .filter(Boolean)
      .join(' ');
  };

  const renderFieldInput = (field: Field) => {
    const value = effectiveAnswers[field.id] ?? (field.field_type === 'checkbox' ? [] : '');
    const config = field.validation_config ?? {};
    const isRequired = field.required || !!fieldStates[field.id]?.required_override;

    // Phase 3: Computed field card
    if (field.field_type === 'computed') {
      const displayVal =
        effectiveAnswers[field.id] !== undefined && effectiveAnswers[field.id] !== null
          ? String(effectiveAnswers[field.id])
          : '';
      const terms = (field.validation_config?.terms as any[]) ?? [];
      const formulaDesc = buildFormulaDescription(terms);
      return (
        <div className="mt-2 flex items-start gap-3 rounded-md border border-dashed border-terracotta/50 bg-terracotta-fixed/30 px-4 py-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-terracotta/10 text-terracotta">
            <Calculator size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-sm font-bold text-terracotta leading-tight">
              {displayVal !== '' ? displayVal : '\u2014'}
            </p>
            {formulaDesc && (
              <p
                className="mt-1 truncate text-[10px] leading-relaxed text-ink-muted"
                title={formulaDesc}
              >
                {formulaDesc}
              </p>
            )}
          </div>
        </div>
      );
    }

    // Phase 5: File upload with extension badges + removable filename chip
    if (field.field_type === 'file' || field.field_type === 'file_upload') {
      const file = files[field.id];
      const answerVal = answers[field.id];
      const hasFile = !!(file || (typeof answerVal === 'string' && answerVal.length > 0));
      const fileName = file ? file.name : typeof answerVal === 'string' ? answerVal : '';
      const allowedExts: string[] =
        Array.isArray((config as any).allowed_extensions) && (config as any).allowed_extensions.length > 0
          ? (config as any).allowed_extensions
          : [];

      const handleRemoveFile = () => {
        setFiles((prev) => ({ ...prev, [field.id]: null }));
        setAnswers((prev) => ({ ...prev, [field.id]: '' }));
      };

      return (
        <div className="mt-2 space-y-2">
          {hasFile ? (
            <div className="flex items-center gap-2 rounded-sm border border-paper-border bg-paper-high/60 px-3 py-2">
              <Upload className="h-4 w-4 shrink-0 text-terracotta" />
              <span className="flex-1 truncate text-xs font-medium text-ink">{fileName}</span>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="cursor-pointer rounded-sm p-0.5 text-ink-muted transition-colors hover:text-brick"
                aria-label="Remove file"
              >
                <XIcon size={13} />
              </button>
            </div>
          ) : (
            <label className="flex w-full cursor-pointer flex-col items-center justify-center rounded-sm border border-dashed border-paper-border bg-paper-high/40 text-ink transition-colors hover:border-terracotta min-h-[90px]">
              <input
                type="file"
                className="sr-only"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0] ?? null;
                  if (selectedFile) {
                    setFiles((prev) => ({ ...prev, [field.id]: selectedFile }));
                    setAnswers((prev) => ({ ...prev, [field.id]: selectedFile.name }));
                  }
                }}
              />
              <div className="flex flex-col items-center justify-center p-3 text-center">
                <Upload className="mb-1.5 h-5 w-5 text-terracotta" />
                <p className="text-xs font-medium text-ink">Click to select or drop a file</p>
                {allowedExts.length > 0 && (
                  <div className="mt-2 flex flex-wrap justify-center gap-1">
                    {allowedExts.map((ext) => (
                      <span
                        key={ext}
                        className="rounded-sm border border-paper-border bg-paper-border/60 px-1.5 py-0.5 font-mono text-[10px] text-ink-muted"
                      >
                        .{ext.replace(/^\./, '')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </label>
          )}
        </div>
      );
    }

    // Phase 4: Rating as 1-5 numbered pill selector
    if (field.field_type === 'rating') {
      const ratingValue = Number(value) || 0;
      return (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {[1, 2, 3, 4, 5].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => setAnswer(field.id, String(num))}
              className={`flex h-9 w-9 cursor-pointer select-none items-center justify-center rounded-full border text-xs font-bold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta ${
                num === ratingValue
                  ? 'border-terracotta bg-terracotta text-white shadow-warm-sm'
                  : 'border-paper-border bg-paper-high/60 text-ink-muted hover:border-terracotta hover:text-terracotta'
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      );
    }

    if (field.field_type === 'textarea') {
      return (
        <textarea
          rows={3}
          required={isRequired}
          placeholder={field.placeholder || 'Enter your response...'}
          value={String(value)}
          onChange={(e) => setAnswer(field.id, e.target.value)}
          className="w-full px-3.5 py-2.5 bg-paper-high/60 border border-paper-border rounded-sm text-xs text-ink outline-none focus:border-terracotta font-sans resize-none"
        />
      );
    }

    if (field.field_type === 'dropdown') {
      return (
        <select
          required={isRequired}
          value={String(value)}
          onChange={(e) => setAnswer(field.id, e.target.value)}
          className="w-full px-3.5 py-2.5 bg-paper-high/60 border border-paper-border rounded-sm text-xs text-ink outline-none focus:border-terracotta font-sans"
        >
          <option value="">Select option...</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.field_type === 'checkbox') {
      return (
        <div className="space-y-2 mt-2">
          {field.options?.map((opt) => {
            const isChecked = Array.isArray(value) && value.includes(opt.value);
            return (
              <label key={opt.value} className="flex items-center gap-2 text-xs text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() =>
                    setAnswer(
                      field.id,
                      isChecked
                        ? value.filter((val) => val !== opt.value)
                        : [...(Array.isArray(value) ? value : []), opt.value]
                    )
                  }
                  className="accent-terracotta w-4 h-4 rounded-sm"
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      );
    }

    if (field.field_type === 'radio') {
      return (
        <div className="space-y-2 mt-2">
          {field.options?.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-xs text-ink cursor-pointer select-none">
              <input
                type="radio"
                name={`radio-${field.id}`}
                checked={value === opt.value}
                onChange={() => setAnswer(field.id, opt.value)}
                className="accent-terracotta w-4 h-4"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      );
    }

    return (
      <input
        type={['text', 'email', 'number', 'password', 'date'].includes(field.field_type) ? field.field_type : 'text'}
        required={isRequired}
        placeholder={field.placeholder || `Enter ${field.label}...`}
        value={String(value)}
        onChange={(e) => setAnswer(field.id, e.target.value)}
        className="w-full px-3.5 py-2.5 bg-paper-high/60 border border-paper-border rounded-sm text-xs text-ink outline-none focus:border-terracotta font-sans"
      />
    );
  };

  const handleSubmitOrNext = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || !submissionId || !publicLink || !accessToken) return;
    setIsSubmitting(true);
    setError('');

    try {
      // 1. Process and upload any pending file fields FIRST
      const updatedAnswers = { ...answers };
      for (const f of visibleCurrentSectionFields) {
        if ((f.field_type === 'file' || f.field_type === 'file_upload') && files[f.id]) {
          try {
            const uploadedRes = await uploadResponseFile(submissionId, f.id, files[f.id]!);
            const fileVal = uploadedRes.file_url || uploadedRes.value_text || files[f.id]!.name;
            updatedAnswers[f.id] = fileVal;
          } catch {
            throw new Error(`Failed to upload file for "${f.label}". Please try again.`);
          }
        }
      }
      setAnswers(updatedAnswers);

      // 2. Validate that all required visible fields in current section are filled
      for (const f of visibleCurrentSectionFields) {
        const isRequired = f.required || !!fieldStates[f.id]?.required_override;
        const val = updatedAnswers[f.id];
        const isEmpty = val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0);
        if (isRequired && isEmpty) {
          setError(`Required field not filled: "${f.label}"`);
          setIsSubmitting(false);
          return;
        }
      }

      // 3. Save text/json submission values to backend (including computed values)
      const valMap: Record<number, string> = {};
      for (const f of visibleCurrentSectionFields) {
        const val = effectiveAnswers[f.id] ?? updatedAnswers[f.id];
        if (val !== undefined && val !== null && val !== '') {
          valMap[f.id] = Array.isArray(val) ? JSON.stringify(val) : String(val);
        }
      }

      await saveSubmissionValues(submissionId, accessToken, valMap);

      if (hasSections && currentSection) {
        setVisitedSections((prev) => [...prev, { id: currentSection.id, title: currentSection.title }]);
        const nextRes = await getNextPage(publicLink, submissionId, currentSection.id, accessToken);

        if (nextRes.is_last_section || nextRes.next_section_id === null) {
          const resSub = await completeSubmission(submissionId, accessToken);
          if ((resSub as any)?.duplicate_warning) {
            setDuplicateWarn(true);
          }
          setIsCompleted(true);
        } else {
          setCurrentSectionId(nextRes.next_section_id);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } else {
        const resSub = await completeSubmission(submissionId, accessToken);
        if ((resSub as any)?.duplicate_warning) {
          setDuplicateWarn(true);
        }
        setIsCompleted(true);
      }
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { detail?: any } } }).response?.data?.detail;
      if (errData && typeof errData === 'object' && errData.code === 'DUPLICATE_BLOCKED') {
        setDuplicateBlocked(true);
        setDuplicateBlockedMessage(
          errData.message || "It looks like you've already submitted this form."
        );
        if (submissionId) {
          getDuplicateOverrideStatus(submissionId)
            .then((res) => {
              if (res.status === 'pending') {
                setOverrideStatus('pending');
                startPollingStatus(submissionId, accessToken ?? undefined);
              } else if (res.status === 'approved') {
                setOverrideStatus('approved');
              } else if (res.status === 'denied') {
                setOverrideStatus('denied');
              }
            })
            .catch(() => {});
        }
      } else {
        const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
        const message = (err as { message?: string }).message;
        setError(
          typeof detail === 'string'
            ? detail
            : message || 'Could not submit responses. Please check all required fields.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // -- Early-return states (unchanged) --

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (scheduleState === 'not_yet_open') {
    return (
      <div className="min-h-screen bg-[#FAF7F0] text-ink flex items-center justify-center p-6 font-sans select-none">
        <div className="max-w-md w-full bg-paper-lowest border border-paper-border rounded-md p-8 text-center space-y-4 shadow-warm-md">
          <div className="w-14 h-14 rounded-full bg-terracotta/10 text-terracotta flex items-center justify-center mx-auto">
            <Clock size={32} />
          </div>
          <h1 className="font-serif text-2xl font-bold text-ink">This form isn't open yet</h1>
          <p className="text-xs text-ink-muted leading-relaxed">
            This form is scheduled to open for responses soon. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  if (scheduleState === 'closed') {
    return (
      <div className="min-h-screen bg-[#FAF7F0] text-ink flex items-center justify-center p-6 font-sans select-none">
        <div className="max-w-md w-full bg-paper-lowest border border-paper-border rounded-md p-8 text-center space-y-4 shadow-warm-md">
          <div className="w-14 h-14 rounded-full bg-slate/10 text-slate flex items-center justify-center mx-auto">
            <Clock size={32} />
          </div>
          <h1 className="font-serif text-2xl font-bold text-ink">This form is now closed</h1>
          <p className="text-xs text-ink-muted leading-relaxed">
            This form is no longer accepting new submissions.
          </p>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] text-ink flex items-center justify-center p-6 select-none font-sans">
        <div className="max-w-md w-full bg-paper-lowest border border-paper-border rounded-md p-8 text-center space-y-4 shadow-warm-md">
          <div className="w-14 h-14 rounded-full bg-forest-fixed text-forest-hover flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} />
          </div>
          <h1 className="font-serif text-2xl font-bold text-ink">Thank you!</h1>
          <p className="text-xs text-ink-muted leading-relaxed">
            We've received your responses. A confirmation copy has been securely recorded.
          </p>
          {duplicateWarn && (
            <InlineBanner
              variant="warning"
              message="Note: this looks similar to a previous response."
              className="text-left mt-3"
            />
          )}
        </div>
      </div>
    );
  }

  // -- Phase 1: Derived step values --
  const totalSteps = form?.sections?.length ?? 0;
  const currentStepIndex = visitedSections.length;
  const estMins = Math.max(1, Math.ceil((form?.fields?.length ?? 3) / 3));

  // -- Phase 6: Field row wrapper with max-height/opacity collapse transition --
  const renderFieldRow = (field: Field) => {
    const isHidden = !!fieldStates[field.id]?.hidden;
    return (
      <div
        key={field.id}
        style={{
          transition: 'max-height 0.3s ease, opacity 0.25s ease, margin-bottom 0.3s ease',
          maxHeight: isHidden ? '0px' : '1000px',
          opacity: isHidden ? 0 : 1,
          marginBottom: isHidden ? '0px' : '24px',
          overflow: 'hidden',
          pointerEvents: isHidden ? 'none' : 'auto',
        }}
      >
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-ink uppercase">
            {field.label}
            {(field.required || fieldStates[field.id]?.required_override) && (
              <span className="text-terracotta ml-0.5">*</span>
            )}
          </label>
          {renderFieldInput(field)}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-ink font-sans flex flex-col justify-between">
      {/* Top Terracotta Accent Line */}
      <div className="h-1.5 bg-terracotta w-full" />

      <main className="flex-1 flex justify-center py-10 px-4">
        <div className="max-w-2xl w-full bg-paper-lowest border border-paper-border rounded-md p-8 sm:p-10 shadow-warm-md space-y-8">

          {/* Phase 1: Header */}
          <div className="space-y-4 border-b border-paper-border pb-6">

            {/* Wordmark + time estimate pill */}
            <div className="flex items-center justify-between">
              <span className="font-serif text-xs font-bold tracking-widest text-terracotta uppercase select-none">
                IForms
              </span>
              {form && (
                <span className="inline-flex items-center gap-1 rounded-full border border-paper-border bg-paper-high/60 px-2.5 py-0.5 text-[11px] text-ink-muted select-none">
                  ~{estMins} min{estMins !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Form title + description */}
            <div>
              <h1 className="font-serif text-3xl font-bold text-ink tracking-tight leading-tight">
                {form?.title || 'Form'}
              </h1>
              {form?.description && (
                <p className="mt-1.5 text-xs text-ink-muted leading-relaxed">{form.description}</p>
              )}
            </div>

            {/* Step indicator -- only for sectioned forms */}
            {hasSections && totalSteps > 0 && (
              <div className="space-y-3 pt-1">
                {/* Pill + connector row */}
                <div className="flex items-center">
                  {form!.sections.map((sec, idx) => {
                    const isDone = idx < currentStepIndex;
                    const isCurrent = idx === currentStepIndex;
                    return (
                      <React.Fragment key={sec.id}>
                        {idx > 0 && (
                          <div
                            className={`h-px flex-1 transition-colors duration-500 ${
                              isDone ? 'bg-forest' : 'bg-paper-border'
                            }`}
                          />
                        )}
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                            isDone
                              ? 'bg-forest text-white'
                              : isCurrent
                              ? 'bg-terracotta text-white shadow-warm-sm scale-110'
                              : 'border border-paper-border bg-paper-high/60 text-ink-muted'
                          }`}
                        >
                          {isDone ? <Check size={12} /> : idx + 1}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Metadata pill */}
                {currentSection && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-terracotta/25 bg-terracotta-fixed/50 px-3 py-1 text-xs font-medium text-terracotta select-none">
                    Step {currentStepIndex + 1} of {totalSteps}: {currentSection.title}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error banner */}
          {error && (
            <div className="p-3 bg-brick-container border border-brick-border text-brick text-xs font-semibold rounded-sm flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Phase 2: duplicateWarn banner shown above active form */}
          {duplicateWarn && !isCompleted && (
            <InlineBanner
              variant="warning"
              title="Possible duplicate detected"
              message="This response looks similar to a previous submission. You may still continue."
            />
          )}

          {/* Form content or Phase 2 duplicate-blocked override panel */}
          {duplicateBlocked ? (
            <div className="space-y-4 rounded-md border border-amber-border bg-amber-container/30 p-6">
              <InlineBanner
                variant="warning"
                title={duplicateBlockedMessage || "It looks like you've already submitted this form."}
                message="This form is configured to prevent duplicate responses."
              />

              {overrideStatus === 'none' && (
                <div className="space-y-3 pt-1">
                  <p className="text-xs text-ink-muted leading-relaxed">
                    If you need to submit an additional entry, you can request permission from the form owner.
                  </p>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleRequestOverride}
                    isLoading={isRequestingOverride}
                  >
                    Request permission to submit anyway
                  </Button>
                </div>
              )}

              {overrideStatus === 'pending' && (
                <div className="flex items-start gap-3 rounded-md border border-amber-border bg-amber-container/60 p-4">
                  <div className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-amber border-t-transparent" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-ink">Waiting for the form owner to respond...</p>
                    <p className="text-[11px] text-ink-muted leading-relaxed">
                      Your request has been sent. This page will update automatically once approved.
                    </p>
                  </div>
                </div>
              )}

              {overrideStatus === 'approved' && (
                <div className="rounded-md border border-forest-border bg-forest-container/60 p-4">
                  <p className="text-xs font-bold text-forest">
                    You've been approved -- submitting your response now...
                  </p>
                </div>
              )}

              {overrideStatus === 'denied' && (
                <div className="space-y-1 rounded-md border border-brick-border bg-brick-container/60 p-4">
                  <p className="text-xs font-bold text-brick">The form owner declined this request.</p>
                  <p className="text-[11px] text-ink-muted">No further submission attempts can be made.</p>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmitOrNext} className="space-y-8">
              {!hasSections || !form?.sections ? (
                <div>
                  {currentSectionFields.map((field) => renderFieldRow(field))}
                </div>
              ) : (
                form.sections.map((sec) => {
                  if (sec.id !== currentSectionId) return null;
                  const secFields =
                    form?.fields.filter((f) => (f.section_id ?? null) === sec.id) || [];
                  return (
                    <div key={sec.id}>
                      <div className="mb-6 flex items-center gap-2.5 border-b border-paper-border pb-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-terracotta/10 text-terracotta">
                          <User size={15} />
                        </div>
                        <h2 className="font-serif text-xl font-bold text-ink">{sec.title}</h2>
                      </div>
                      <div>
                        {secFields.map((field) => renderFieldRow(field))}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Phase 7: Footer navigation */}
              <div className="flex items-center justify-between gap-4 border-t border-paper-border pt-6">
                {visitedSections.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={handleBack}
                    isLoading={isGoingBack}
                    leftIcon={<ArrowLeft size={14} />}
                  >
                    Back
                  </Button>
                ) : (
                  <div className="invisible h-10 w-20" aria-hidden />
                )}

                <div className="flex select-none flex-col items-center gap-0.5">
                  <Lock size={12} className="text-ink-muted" />
                  <span className="text-center font-sans text-[10px] leading-tight text-ink-muted">
                    256-bit encrypted
                  </span>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSubmitting}
                  rightIcon={<ArrowRight size={14} />}
                >
                  {hasSections ? 'Next Step' : 'Submit'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* Page Footer */}
      <footer className="py-6 text-center text-xs text-ink-muted">
        <p>&#169; 2026 IForms Editorial Systems. Encrypted &amp; Secure.</p>
      </footer>
    </div>
  );
};

export default PublicFormFill;

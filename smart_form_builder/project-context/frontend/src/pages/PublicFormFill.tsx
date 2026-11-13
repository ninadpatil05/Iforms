import React, { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Upload,
  Star,
  User,
  Calendar,
  Clock,
  AlignLeft,
  ArrowRight,
  ArrowLeft,
  Check,
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

  const fieldStates = useMemo(
    () => resolveFieldStates(form?.condition_groups ?? [], answers),
    [form?.condition_groups, answers]
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

  const renderFieldInput = (field: Field) => {
    const value = answers[field.id] ?? (field.field_type === 'checkbox' ? [] : '');
    const config = field.validation_config ?? {};
    const isRequired = field.required || !!fieldStates[field.id]?.required_override;

    if (field.field_type === 'computed') {
      const terms = config.terms as any[];
      const decimalPlaces = typeof config.decimal_places === 'number' ? config.decimal_places : 2;
      const computedVal = evaluateFormula(terms, answers, decimalPlaces);
      const displayVal = computedVal !== null ? String(computedVal) : '';
      return (
        <input
          type="text"
          disabled
          readOnly
          value={displayVal}
          placeholder="Calculated live value..."
          className="w-full px-3.5 py-2.5 bg-terracotta-fixed border border-terracotta/30 rounded-sm text-xs font-mono font-bold text-terracotta cursor-not-allowed"
        />
      );
    }

    if (field.field_type === 'file' || field.field_type === 'file_upload') {
      const file = files[field.id];
      const answerVal = answers[field.id];
      const hasFile = file || (typeof answerVal === 'string' && answerVal.length > 0);
      const fileName = file ? file.name : typeof answerVal === 'string' ? answerVal : '';

      return (
        <div className="mt-2">
          <label className="flex flex-col items-center justify-center w-full min-h-[90px] border border-dashed border-paper-border bg-paper-high/40 hover:border-terracotta text-ink transition-colors cursor-pointer rounded-sm">
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
              <Upload className="w-5 h-5 text-terracotta mb-1" />
              <p className="text-xs font-medium text-ink">
                {hasFile ? fileName : 'Click to select or drop a file'}
              </p>
              {hasFile && (
                <span className="text-[10px] font-mono text-forest font-bold mt-1">
                  ✓ File attached
                </span>
              )}
            </div>
          </label>
        </div>
      );
    }

    if (field.field_type === 'rating') {
      const ratingValue = Number(value) || 0;
      return (
        <div className="flex items-center gap-1.5 mt-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setAnswer(field.id, String(star))}
              className="p-1 cursor-pointer bg-transparent border-none"
            >
              <Star
                className={`w-6 h-6 ${
                  star <= ratingValue ? 'text-amber fill-amber-container' : 'text-ink-subtle'
                }`}
              />
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

      // 3. Save text/json submission values to backend
      const valMap: Record<number, string> = {};
      for (const f of visibleCurrentSectionFields) {
        const val = updatedAnswers[f.id];
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
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs rounded-sm mt-3">
              Note: this looks similar to a previous response.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-ink font-sans flex flex-col justify-between">
      {/* Top Terracotta Accent Line */}
      <div className="h-1.5 bg-terracotta w-full" />

      {/* Main Centered Form Container matching public_form_view screenshot */}
      <main className="flex-1 flex justify-center py-10 px-4">
        <div className="max-w-2xl w-full bg-paper-lowest border border-paper-border rounded-md p-8 sm:p-10 shadow-warm-md space-y-8">
          {/* Header Card */}
          <div className="space-y-3 border-b border-paper-border pb-6">
            <h1 className="font-serif text-3xl font-bold text-ink tracking-tight">
              {form?.title || 'Annual Symposium Registration'}
            </h1>
            <p className="text-xs text-ink-muted leading-relaxed">
              {form?.description ||
                'Please complete all required fields below to secure your attendance. Your information is securely encrypted.'}
            </p>
          </div>

          {error && (
            <div className="p-3 bg-brick-container border border-brick-border text-brick text-xs font-semibold rounded-sm flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Form Content Body or Duplicate Block Override */}
          {duplicateBlocked ? (
            <div className="p-6 bg-paper-high/60 border border-paper-border rounded-sm space-y-5 text-center">
              <div className="w-12 h-12 bg-amber-500/10 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle size={28} />
              </div>

              <div className="space-y-1">
                <h2 className="font-serif text-xl font-bold text-ink">
                  {duplicateBlockedMessage || "It looks like you've already submitted this form."}
                </h2>
                <p className="text-xs text-ink-muted leading-relaxed">
                  This form is configured to prevent duplicate responses.
                </p>
              </div>

              {overrideStatus === 'none' && (
                <div className="space-y-3 pt-2">
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
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-900 rounded-sm text-xs space-y-2">
                  <div className="flex items-center justify-center gap-2 font-semibold">
                    <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                    <span>Waiting for the form owner to respond…</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Your request has been sent to the form owner. This page will update automatically once approved.
                  </p>
                </div>
              )}

              {overrideStatus === 'approved' && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 rounded-sm text-xs space-y-1">
                  <p className="font-bold">You've been approved — submitting your response now…</p>
                </div>
              )}

              {overrideStatus === 'denied' && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-900 rounded-sm text-xs space-y-1">
                  <p className="font-bold">The form owner declined this request.</p>
                  <p className="text-[11px] text-rose-800">No further submission attempts can be made.</p>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmitOrNext} className="space-y-8">
            {!hasSections || !form?.sections ? (
              <div className="space-y-6">
                {visibleCurrentSectionFields.map((field) => (
                  <div key={field.id} className="space-y-1.5">
                    <label className="block text-xs font-semibold text-ink uppercase">
                      {field.label}
                      {(field.required || fieldStates[field.id]?.required_override) && (
                        <span className="text-terracotta ml-0.5">*</span>
                      )}
                    </label>
                    {renderFieldInput(field)}
                  </div>
                ))}
              </div>
            ) : (
              form.sections.map((sec) => {
                if (sec.id !== currentSectionId) return null;
                const secFields = form?.fields.filter((f) => (f.section_id ?? null) === sec.id) || [];
                const visibleSecFields = secFields.filter((f) => !fieldStates[f.id]?.hidden);

                return (
                  <div key={sec.id} className="space-y-6">
                    <div className="flex items-center gap-2 border-b border-paper-border pb-2">
                      <User size={18} className="text-terracotta" />
                      <h2 className="font-serif text-xl font-bold text-ink">{sec.title}</h2>
                    </div>

                    <div className="space-y-6">
                      {visibleSecFields.map((field) => (
                        <div key={field.id} className="space-y-1.5">
                          <label className="block text-xs font-semibold text-ink uppercase">
                            {field.label}
                            {(field.required || fieldStates[field.id]?.required_override) && (
                              <span className="text-terracotta ml-0.5">*</span>
                            )}
                          </label>
                          {renderFieldInput(field)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}

            {/* Footer Action Buttons */}
            <div className="pt-6 border-t border-paper-border flex items-center justify-between">
              {visitedSections.length > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleBack}
                  isLoading={isGoingBack}
                >
                  <ArrowLeft size={15} /> Back
                </Button>
              ) : (
                <Button type="button" variant="ghost" size="md">
                  Save Draft
                </Button>
              )}

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSubmitting}
              >
                <span>{hasSections ? 'Continue' : 'Submit Registration'}</span>
                <ArrowRight size={15} />
              </Button>
            </div>
          </form>
        )}
        </div>
      </main>

      {/* Page Footer */}
      <footer className="py-6 text-center text-xs text-ink-muted">
        <p>© 2026 IForms Editorial Systems. Encrypted & Secure.</p>
      </footer>
    </div>
  );
};

export default PublicFormFill;

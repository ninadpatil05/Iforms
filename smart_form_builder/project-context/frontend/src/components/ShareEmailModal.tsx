import React, { useState, useEffect, useMemo } from 'react';
import { Form } from '@/types/form';
import { useAuth } from '@/context/AuthContext';
import { Button } from './Button';
import { CornerBrackets } from './CornerBrackets';
import { shareFormViaEmail, ShareEmailResponse } from '@/api/shareEmail';
import { Mail, X, CheckCircle, AlertCircle, Calendar, Clock, MapPin, Tag, Send, CalendarClock } from 'lucide-react';

interface ShareEmailModalProps {
  isOpen: boolean;
  form: Form;
  publicUrl?: string;
  onClose: () => void;
  onScheduled?: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toLocalDatetimeInput = (offsetMs: number): string => {
  const d = new Date(Date.now() + offsetMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
};

const MIN_OFFSET_MS = 5 * 60 * 1000;
const MAX_OFFSET_MS = 90 * 24 * 3600 * 1000;

export const ShareEmailModal: React.FC<ShareEmailModalProps> = ({
  isOpen,
  form,
  publicUrl = '',
  onClose,
  onScheduled,
}) => {
  const { user } = useAuth();

  const [sendMode, setSendMode] = useState<'now' | 'scheduled'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [recipientInput, setRecipientInput] = useState('');
  const [emailChips, setEmailChips] = useState<string[]>([]);

  const [subject, setSubject] = useState('');
  const [purpose, setPurpose] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [location, setLocation] = useState('');
  const [customNotes, setCustomNotes] = useState('');

  const [messageBody, setMessageBody] = useState('');
  const [isBodyManuallyEdited, setIsBodyManuallyEdited] = useState(false);

  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<ShareEmailResponse | null>(null);
  const [scheduledConfirm, setScheduledConfirm] = useState<{ id: number; at: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSubject(`Invitation to complete: ${form.title}`);
      setSendResult(null);
      setScheduledConfirm(null);
      setErrorMessage(null);
      setIsBodyManuallyEdited(false);
      setSendMode('now');
      setScheduledAt('');
      setScheduleError(null);
    }
  }, [isOpen, form.title]);

  const generatedBody = useMemo(() => {
    const lines: string[] = ['Hi,', '', 'You are invited to complete the following form.', ''];

    const detailLines: string[] = [];
    if (purpose.trim()) {
      detailLines.push(`Purpose: ${purpose.trim()}`);
    }
    if (meetingDate || meetingTime.trim()) {
      const dateStr = meetingDate
        ? new Date(meetingDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        : '';
      const timeStr = meetingTime.trim();
      const combined = [dateStr, timeStr].filter(Boolean).join(' at ');
      detailLines.push(`Date & Time: ${combined}`);
    }
    if (location.trim()) {
      detailLines.push(`Location/Link: ${location.trim()}`);
    }

    if (detailLines.length > 0) {
      lines.push(...detailLines, '');
    }

    if (customNotes.trim()) {
      lines.push('Additional details:', customNotes.trim(), '');
    }

    lines.push('Please use this link to access the form:', '{Form Public Link}', '');
    lines.push('Regards,');
    lines.push(user?.name || 'Form Owner');

    return lines.join('\n');
  }, [purpose, meetingDate, meetingTime, location, customNotes, user?.name]);

  useEffect(() => {
    if (!isBodyManuallyEdited) {
      setMessageBody(generatedBody);
    }
  }, [generatedBody, isBodyManuallyEdited]);

  const addEmailChips = (rawText: string) => {
    const tokens = rawText
      .split(/[\s,;\n]+/)
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    if (tokens.length > 0) {
      setEmailChips((prev) => {
        const next = [...prev];
        for (const token of tokens) {
          if (!next.includes(token)) {
            next.push(token);
          }
        }
        return next;
      });
      setRecipientInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', ' ', 'Tab'].includes(e.key)) {
      if (recipientInput.trim()) {
        e.preventDefault();
        addEmailChips(recipientInput);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted) {
      e.preventDefault();
      addEmailChips(pasted);
    }
  };

  const removeChip = (indexToRemove: number) => {
    setEmailChips((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const invalidChips = useMemo(() => {
    return emailChips.filter((email) => !EMAIL_REGEX.test(email));
  }, [emailChips]);

  const hasInvalidEmails = invalidChips.length > 0;

  const validateSchedule = (): boolean => {
    if (sendMode !== 'scheduled') return true;
    if (!scheduledAt) {
      setScheduleError('Please select a scheduled send time.');
      return false;
    }
    const chosen = new Date(scheduledAt).getTime();
    const now = Date.now();
    if (chosen < now + MIN_OFFSET_MS) {
      setScheduleError('Scheduled time must be at least 5 minutes from now.');
      return false;
    }
    if (chosen > now + MAX_OFFSET_MS) {
      setScheduleError('Scheduled time must be within 90 days from now.');
      return false;
    }
    setScheduleError(null);
    return true;
  };

  const canSend =
    emailChips.length > 0 &&
    !hasInvalidEmails &&
    subject.trim().length > 0 &&
    !isSending &&
    (sendMode === 'now' || scheduledAt !== '');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalEmails = [...emailChips];
    if (recipientInput.trim()) {
      const leftoverTokens = recipientInput
        .split(/[\s,;\n]+/)
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);
      for (const token of leftoverTokens) {
        if (!finalEmails.includes(token)) {
          finalEmails.push(token);
        }
      }
      setEmailChips(finalEmails);
      setRecipientInput('');
    }

    const invalid = finalEmails.filter((email) => !EMAIL_REGEX.test(email));
    if (invalid.length > 0) {
      setErrorMessage(`Please fix or remove invalid email address: ${invalid.join(', ')}`);
      return;
    }

    if (finalEmails.length === 0) {
      setErrorMessage('Please enter at least one recipient email address.');
      return;
    }

    if (!validateSchedule()) return;

    setIsSending(true);
    setErrorMessage(null);
    setSendResult(null);
    setScheduledConfirm(null);

    try {
      const payload: Parameters<typeof shareFormViaEmail>[1] = {
        recipient_emails: finalEmails,
        subject: subject.trim(),
        message: messageBody,
      };

      if (sendMode === 'scheduled' && scheduledAt) {
        payload.scheduled_at = new Date(scheduledAt).toISOString();
      }

      const response = await shareFormViaEmail(form.id, payload);

      if (response.scheduled && response.scheduled_email_id != null) {
        setScheduledConfirm({
          id: response.scheduled_email_id,
          at: scheduledAt,
        });
        onScheduled?.();
      } else {
        setSendResult(response);
      }
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { detail?: unknown }; status?: number } };
      const detail = errObj.response?.data?.detail;
      const httpStatus = errObj.response?.status;
      if (typeof detail === 'string') {
        setErrorMessage(detail);
      } else if (Array.isArray(detail)) {
        setErrorMessage((detail as Array<{ msg?: string }>).map((d) => d.msg || JSON.stringify(d)).join(', '));
      } else if (httpStatus === 503) {
        setErrorMessage('Server error: email service unavailable. Check backend logs for details.');
      } else {
        setErrorMessage('Request failed. Please try again or check the browser console for details.');
      }
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  const minDatetime = toLocalDatetimeInput(MIN_OFFSET_MS);
  const maxDatetime = toLocalDatetimeInput(MAX_OFFSET_MS);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-2xl my-8 bg-cream border-1.5 border-ink shadow-hard-lg overflow-hidden flex flex-col max-h-[90vh] text-ink">
        <CornerBrackets active />
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-ink/20 flex items-center justify-between bg-cream-soft">
          <div className="flex items-center gap-3">
            <div className="p-2 border border-ink/30 bg-white text-cyan-dark">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-display font-bold uppercase tracking-tight text-ink">Share via Email</h2>
              <p className="font-mono text-[11px] text-slate">Direct invitation distribution</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate hover:text-ink p-1 border border-transparent hover:border-ink/30 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-cream">
          <form id="share-email-form" onSubmit={handleSend} className="space-y-5">
            {/* Recipients Chips Input */}
            <div>
              <label className="block font-sans text-xs font-semibold text-ink mb-1.5">
                Recipients (Comma, space, or Enter to separate)
              </label>
              <div
                className={`min-h-[44px] p-2 border ${
                  hasInvalidEmails
                    ? 'border-danger'
                    : 'border-ink/30 focus-within:border-cyan-dark'
                } bg-cream-soft flex flex-wrap items-center gap-1.5`}
              >
                {emailChips.map((email, idx) => {
                  const isValid = EMAIL_REGEX.test(email);
                  return (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium border ${
                        isValid
                          ? 'bg-cyan-tint text-cyan-dark border-cyan/40'
                          : 'bg-danger-tint text-danger border-danger/40'
                      }`}
                    >
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() => removeChip(idx)}
                        className="hover:opacity-75 focus:outline-none cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  );
                })}
                <input
                  type="text"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  onBlur={() => {
                    if (recipientInput.trim()) addEmailChips(recipientInput);
                  }}
                  placeholder={emailChips.length === 0 ? 'e.g. user@example.com, john@domain.com' : 'Add email...'}
                  className="flex-1 min-w-[180px] bg-transparent border-0 outline-none p-1 text-sm text-ink placeholder:text-slate-light"
                />
              </div>

              {hasInvalidEmails && (
                <p className="mt-1.5 font-mono text-xs text-danger flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Invalid email format: {invalidChips.join(', ')}
                </p>
              )}
            </div>

            {/* Subject */}
            <div>
              <label className="block font-sans text-xs font-semibold text-ink mb-1.5">
                Subject Line
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3.5 py-2 border border-ink/30 bg-cream-soft text-sm text-ink outline-none focus:border-cyan-dark"
              />
            </div>

            {/* Optional Fields */}
            <div className="p-4 border border-ink/20 bg-white space-y-3">
              <h4 className="font-mono text-xs font-bold text-slate flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-cyan-dark" /> OPTIONAL DETAILS
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-sans text-slate mb-1">Meeting Purpose</label>
                  <input
                    type="text"
                    placeholder="e.g. Annual Feedback Survey"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full px-3 py-1.5 border border-ink/30 bg-cream-soft text-xs text-ink outline-none focus:border-cyan-dark"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-sans text-slate mb-1">Location / Link</label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-light" />
                    <input
                      type="text"
                      placeholder="e.g. Conference Room A / Zoom"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-ink/30 bg-cream-soft text-xs text-ink outline-none focus:border-cyan-dark"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-sans text-slate mb-1">Meeting Date</label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-light" />
                    <input
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-ink/30 bg-cream-soft text-xs text-ink outline-none focus:border-cyan-dark"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-sans text-slate mb-1">Meeting Time</label>
                  <div className="relative">
                    <Clock className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-light" />
                    <input
                      type="text"
                      placeholder="e.g. 2:00 PM EST"
                      value={meetingTime}
                      onChange={(e) => setMeetingTime(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-ink/30 bg-cream-soft text-xs text-ink outline-none focus:border-cyan-dark"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Email Message Preview / Editable Area */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-sans text-xs font-semibold text-ink">
                  Email Message Body (Editable)
                </label>
                {isBodyManuallyEdited && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsBodyManuallyEdited(false);
                      setMessageBody(generatedBody);
                    }}
                    className="font-mono text-[11px] text-cyan-dark hover:underline cursor-pointer bg-transparent border-none"
                  >
                    Reset template
                  </button>
                )}
              </div>
              <textarea
                rows={5}
                value={messageBody}
                onChange={(e) => {
                  setIsBodyManuallyEdited(true);
                  setMessageBody(e.target.value);
                }}
                className="w-full px-3.5 py-2.5 font-mono text-xs leading-relaxed border border-ink/30 bg-cream-soft text-ink outline-none focus:border-cyan-dark"
              />
            </div>

            {/* Send mode toggle */}
            <div className="space-y-2.5">
              <label className="block font-sans text-xs font-semibold text-ink">
                Delivery Schedule
              </label>

              <div className="inline-flex border border-ink/30 text-xs font-medium bg-white">
                <button
                  type="button"
                  onClick={() => { setSendMode('now'); setScheduleError(null); }}
                  className={`flex items-center gap-1.5 px-4 py-2 cursor-pointer transition-colors ${
                    sendMode === 'now'
                      ? 'bg-cyan text-shadow font-semibold'
                      : 'bg-transparent text-ink hover:bg-cream-soft'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  Send now
                </button>
                <button
                  type="button"
                  onClick={() => setSendMode('scheduled')}
                  className={`flex items-center gap-1.5 px-4 py-2 border-l border-ink/30 cursor-pointer transition-colors ${
                    sendMode === 'scheduled'
                      ? 'bg-cyan text-shadow font-semibold'
                      : 'bg-transparent text-ink hover:bg-cream-soft'
                  }`}
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                  Schedule for later
                </button>
              </div>

              {sendMode === 'scheduled' && (
                <div className="space-y-1.5 pt-1">
                  <label htmlFor="schedule-datetime" className="block font-mono text-[11px] text-slate">
                    Send at (Local time) — 5 min to 90 days ahead
                  </label>
                  <input
                    id="schedule-datetime"
                    type="datetime-local"
                    value={scheduledAt}
                    min={minDatetime}
                    max={maxDatetime}
                    onChange={(e) => {
                      setScheduledAt(e.target.value);
                      setScheduleError(null);
                    }}
                    className="w-full px-3.5 py-2 border border-ink/30 bg-cream-soft text-sm text-ink outline-none focus:border-cyan-dark"
                  />
                  {scheduleError && (
                    <p className="font-mono text-xs text-danger flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {scheduleError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Error Display */}
            {errorMessage && (
              <div className="p-3.5 bg-danger-tint border border-danger/40 text-danger text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Sharing Error</p>
                  <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Scheduled confirmation banner */}
            {scheduledConfirm && (
              <div className="p-4 bg-cyan-tint border border-cyan/40 text-xs space-y-1">
                <div className="flex items-center gap-2 text-cyan-dark font-bold text-sm">
                  <CalendarClock className="w-4 h-4 text-cyan-dark" />
                  Scheduled successfully!
                </div>
                <p className="text-ink font-mono">
                  Delivery time: {new Date(scheduledConfirm.at).toLocaleString()}
                </p>
              </div>
            )}

            {/* Tally / Success Display */}
            {sendResult && (
              <div className="p-4 bg-success-tint border border-success/40 text-xs space-y-2">
                <div className="flex items-center gap-2 text-success font-bold text-sm">
                  <CheckCircle className="w-4 h-4 text-success" />
                  Sent to {sendResult.sent_count} of {sendResult.sent_count + sendResult.failed.length} recipients.
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-ink/20 bg-cream-soft flex items-center justify-end gap-2.5">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSending}>
            {scheduledConfirm || sendResult ? 'Close' : 'Cancel'}
          </Button>
          {!scheduledConfirm && !sendResult && (
            <Button
              type="submit"
              form="share-email-form"
              variant="primary"
              size="sm"
              isLoading={isSending}
              disabled={!canSend}
              className="gap-2"
            >
              {sendMode === 'scheduled' ? (
                <>
                  <CalendarClock className="w-4 h-4" />
                  <span>Schedule ({emailChips.length})</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  <span>Send Email ({emailChips.length})</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

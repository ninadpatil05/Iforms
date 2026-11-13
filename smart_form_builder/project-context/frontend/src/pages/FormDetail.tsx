import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Button, IconButton } from '@/components/Button';
import { Input } from '@/components/Input';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MetricCard } from '@/components/MetricCard';
import { CornerBrackets } from '@/components/CornerBrackets';
import { BlueprintLayer } from '@/components/BlueprintLayer';
import { Form, FormUpdatePayload } from '@/types/form';
import { getFormById, updateForm, archiveForm, deleteForm, publishForm, unpublishForm, getPublishedFormLink, getFormSubmissions, type FormSubmission } from '@/api/forms';
import { FormInvite, listInvites, createInvites, deleteInvite } from '@/api/invites';
import { downloadResponseFile } from '@/api/responseValues';
import { exportSubmissions, type ExportFormat } from '@/api/export';
import { listScheduledEmails, cancelScheduledEmail, type ScheduledEmailShare } from '@/api/scheduledEmails';

import {
  ArrowLeft,
  Pencil,
  Check,
  X,
  Archive,
  Trash2,
  AlertCircle,
  CalendarDays,
  RefreshCw,
  Wrench,
  Copy,
  Send,
  BarChart2,
  Download,
  Filter,
  FileSpreadsheet,
  FileText,
  Mail,
  CalendarClock,
  Clock,
  Sparkles,
} from 'lucide-react';

import { ShareEmailModal } from '@/components/ShareEmailModal';
import { SubmissionsView } from '@/components/SubmissionsView';
import { PublishShareModal } from '@/components/PublishShareModal';
import { FormScheduleDuplicateSettings } from '@/components/FormScheduleDuplicateSettings';
import { DuplicateOverridePanel } from '@/components/DuplicateOverridePanel';

interface EditableFieldProps {
  id: string;
  label: string;
  value: string;
  isEditing: boolean;
  multiline?: boolean;
  error?: string;
  maxLength?: number;
  onChange: (v: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

const EditableField: React.FC<EditableFieldProps> = ({
  id,
  label,
  value,
  isEditing,
  multiline,
  error,
  maxLength,
  onChange,
  onEdit,
  onSave,
  onCancel,
  isSaving,
}) => {
  if (isEditing) {
    return (
      <div className="space-y-2">
        {multiline ? (
          <div className="space-y-1.5">
            <label htmlFor={id} className="block font-sans text-xs font-semibold text-ink">
              {label}
            </label>
            <textarea
              id={id}
              rows={4}
              autoFocus
              value={value}
              maxLength={maxLength}
              onChange={e => onChange(e.target.value)}
              className="w-full border border-ink/30 bg-cream-soft px-3 py-2 text-sm text-ink outline-none focus:border-cyan-dark resize-none font-sans"
            />
          </div>
        ) : (
          <Input
            id={id}
            label={label}
            value={value}
            maxLength={maxLength}
            error={error}
            onChange={e => onChange(e.target.value)}
            autoFocus
          />
        )}
        {maxLength && (
          <p className="text-[10px] font-mono text-slate text-right">
            {value.length}/{maxLength}
          </p>
        )}
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" onClick={onSave} isLoading={isSaving} className="gap-1">
            <Check className="w-3.5 h-3.5" />
            <span>Save</span>
          </Button>
          <Button size="sm" variant="secondary" onClick={onCancel} disabled={isSaving} className="gap-1">
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative border border-transparent hover:border-ink/20 p-3 -mx-3 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <span className="block font-mono text-[10.5px] uppercase tracking-wider text-slate">
            {label}
          </span>
          <p className={`text-ink ${multiline ? 'text-sm leading-relaxed whitespace-pre-wrap font-sans' : 'text-xl font-display font-bold'}`}>
            {value || <span className="italic text-slate text-sm font-normal">No description provided</span>}
          </p>
        </div>
        <button
          onClick={onEdit}
          aria-label={`Edit ${label}`}
          className="opacity-0 group-hover:opacity-100 p-1.5 border border-ink/20 bg-white text-slate hover:text-ink transition-all shrink-0 cursor-pointer"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export const FormDetail: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();

  const [form, setForm] = useState<Form | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);
  const [isNotFound, setIsNotFound] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleError, setTitleError] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);

  const [editingDescription, setEditingDescription] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [savingDesc, setSavingDesc] = useState(false);

  const [isArchiving, setIsArchiving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [expandedSubmission, setExpandedSubmission] = useState<number | null>(null);

  const [invites, setInvites] = useState<FormInvite[]>([]);
  const [inviteEmails, setInviteEmails] = useState('');
  const [inviteMaxUses, setInviteMaxUses] = useState(1);
  const [creatingInvites, setCreatingInvites] = useState(false);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteCopiedId, setInviteCopiedId] = useState<number | null>(null);
  const [isShareEmailModalOpen, setIsShareEmailModalOpen] = useState(false);

  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmailShare[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [cancellingScheduleId, setCancellingScheduleId] = useState<number | null>(null);

  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'in_progress' | 'submitted' | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const id = Number(formId);

  const loadForm = useCallback(async () => {
    if (!id || isNaN(id)) {
      setIsNotFound(true);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setFetchError(null);
    setIsForbidden(false);
    setIsNotFound(false);
    try {
      const data = await getFormById(id);
      setForm(data);
      setSubmissions(await getFormSubmissions(id));
      if (data.status === 'published') {
        try {
          const published = await getPublishedFormLink(id);
          setShareUrl(published.public_url);
        } catch { setShareUrl(''); }
        try {
          setScheduledEmails(await listScheduledEmails(id));
        } catch { setScheduledEmails([]); }
      } else setShareUrl('');

      if (data.access_mode === 'invite_only') {
        try {
          const invList = await listInvites(id);
          setInvites(invList);
        } catch { setInvites([]); }
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) setIsForbidden(true);
      else if (status === 404) setIsNotFound(true);
      else setFetchError('Failed to load form. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const loadInvites = useCallback(async () => {
    if (!id) return;
    setLoadingInvites(true);
    setInviteError('');
    try {
      const data = await listInvites(id);
      setInvites(data);
    } catch {
      setInviteError('Failed to load invites.');
    } finally {
      setLoadingInvites(false);
    }
  }, [id]);

  const loadScheduledEmails = useCallback(async () => {
    if (!id) return;
    setLoadingScheduled(true);
    try {
      setScheduledEmails(await listScheduledEmails(id));
    } catch { /* ignore */ }
    finally { setLoadingScheduled(false); }
  }, [id]);

  const handleCancelSchedule = async (scheduleId: number) => {
    if (!id) return;
    setCancellingScheduleId(scheduleId);
    try {
      await cancelScheduledEmail(id, scheduleId);
      await loadScheduledEmails();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { detail?: string } } };
      alert(errObj.response?.data?.detail || 'Failed to cancel scheduled email.');
    } finally {
      setCancellingScheduleId(null);
    }
  };

  const handleCreateInvites = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !inviteEmails.trim()) return;
    setCreatingInvites(true);
    setInviteError('');
    try {
      const emailsList = inviteEmails
        .split(/[\n,;]+/)
        .map(email => email.trim())
        .filter(email => !!email);

      if (emailsList.length === 0) {
        setInviteError('Please enter at least one valid email address.');
        setCreatingInvites(false);
        return;
      }

      await createInvites(id, emailsList, inviteMaxUses);
      setInviteEmails('');
      await loadInvites();
    } catch {
      setInviteError('Failed to create invites.');
    } finally {
      setCreatingInvites(false);
    }
  };

  const handleDeleteInvite = async (inviteId: number) => {
    if (!id) return;
    try {
      await deleteInvite(id, inviteId);
      await loadInvites();
    } catch {
      setInviteError('Failed to delete invite.');
    }
  };

  const handleAccessModeChange = async (mode: 'public' | 'invite_only') => {
    if (!form || !id) return;
    try {
      const updated = await updateForm(id, { access_mode: mode });
      setForm(updated);
      if (mode === 'invite_only') {
        await listInvites(id).then(setInvites).catch(() => setInvites([]));
      }
    } catch {
      setActionError('Failed to update form access mode.');
    }
  };

  const handleAllowResubmissionChange = async (allow: boolean) => {
    if (!form || !id) return;
    try {
      const updated = await updateForm(id, { allow_resubmission: allow });
      setForm(updated);
    } catch {
      setActionError('Failed to update resubmission preference.');
    }
  };

  const copyInviteLink = (link: string, inviteId: number) => {
    navigator.clipboard.writeText(link);
    setInviteCopiedId(inviteId);
    setTimeout(() => setInviteCopiedId(null), 2000);
  };

  useEffect(() => {
    loadForm();
  }, [loadForm]);

  const startEditTitle = () => {
    setTitleDraft(form?.title ?? '');
    setTitleError('');
    setEditingTitle(true);
  };
  const cancelEditTitle = () => setEditingTitle(false);
  const saveTitle = async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed) { setTitleError('Title is required'); return; }
    setSavingTitle(true);
    try {
      const updated = await updateForm(id, { title: trimmed });
      setForm(updated);
      setEditingTitle(false);
    } catch {
      setTitleError('Failed to update title');
    } finally {
      setSavingTitle(false);
    }
  };

  const startEditDesc = () => {
    setDescDraft(form?.description ?? '');
    setEditingDescription(true);
  };
  const cancelEditDesc = () => setEditingDescription(false);
  const saveDesc = async () => {
    setSavingDesc(true);
    try {
      const payload: FormUpdatePayload = { description: descDraft.trim() || null };
      const updated = await updateForm(id, payload);
      setForm(updated);
      setEditingDescription(false);
    } catch {
      setActionError('Failed to update description');
    } finally {
      setSavingDesc(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true); setActionError(null);
    try {
      const result = await publishForm(id);
      setShareUrl(result.public_url);
      setForm(prev => prev ? { ...prev, status: 'published' } : prev);
    } catch { setActionError('Could not publish this form.'); }
    finally { setIsPublishing(false); }
  };

  const handleUnpublish = async () => {
    setIsPublishing(true); setActionError(null);
    try {
      await unpublishForm(id);
      setShareUrl('');
      setForm(prev => prev ? { ...prev, status: 'draft' } : prev);
    } catch { setActionError('Could not unpublish this form.'); }
    finally { setIsPublishing(false); }
  };

  const handleArchive = async () => {
    setIsArchiving(true); setActionError(null);
    try {
      const updated = await archiveForm(id);
      setForm(updated);
    } catch { setActionError('Failed to archive form.'); }
    finally { setIsArchiving(false); }
  };

  const handleDelete = async () => {
    setIsDeleting(true); setActionError(null);
    try {
      await deleteForm(id);
      navigate('/forms');
    } catch {
      setActionError('Failed to delete form.');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    setExportingFormat(format);
    setActionError(null);
    try {
      await exportSubmissions(id, format, {
        status_filter: statusFilter || undefined,
        date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        date_to: dateTo ? new Date(dateTo).toISOString() : undefined,
        search: searchQuery || undefined,
      });
    } catch {
      setActionError(`Could not export submissions as ${format.toUpperCase()}.`);
    } finally {
      setExportingFormat(null);
    }
  };

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Public form link copied to clipboard!');
    } catch {
      prompt('Copy this link:', shareUrl);
    }
  };

  const downloadFile = async (responseId: number) => {
    try {
      const blob = await downloadResponseFile(responseId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'response-file';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setActionError('Could not download the uploaded file.');
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return iso; }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream text-ink">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <div className="w-8 h-8 border-2 border-cyan border-t-transparent animate-spin mx-auto mb-3" />
          <p className="font-mono text-[11px] text-slate">LOADING FORM METRICS…</p>
        </div>
      </div>
    );
  }

  if (isForbidden || isNotFound || fetchError) {
    return (
      <div className="min-h-screen bg-cream text-ink">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <div className="border border-dashed border-ink/30 bg-white p-8">
            <AlertCircle className="w-6 h-6 text-slate mx-auto mb-3" />
            <h2 className="font-display font-bold text-lg mb-2">{fetchError || (isForbidden ? 'Access Denied' : 'Form Not Found')}</h2>
            <Link to="/forms">
              <Button variant="secondary" size="sm"><ArrowLeft className="w-4 h-4 mr-1.5" /> Back to My Forms</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="min-h-screen bg-cream text-ink relative transition-colors duration-200">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <BlueprintLayer />

        <div className="flex justify-between items-start mb-6 flex-wrap gap-4 relative z-10">
          <div>
            <span className="font-mono text-[11px] text-slate-light">FRM-{String(form.id).padStart(4, '0')}</span>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink mt-0.5">
              {form.title}
            </h1>
            <div className="mt-2 flex items-center gap-3">
              <StatusBadge status={form.status} />
              <span className="font-mono text-xs text-slate">Created {formatDate(form.created_at)}</span>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={() => handleExport('csv')}>
              <Download size={14} /> Export CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate(`/forms/${id}/build`)}>
              <Wrench size={14} /> Open in Builder
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate(`/forms/${id}/ai-analysis`)}>
              <Sparkles size={14} className="text-accent" /> AI Analysis
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate(`/forms/${id}/analytics`)}>
              <BarChart2 size={14} /> Analytics
            </Button>
          </div>
        </div>

        {/* Metric Cards Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-8 relative z-10">
          <MetricCard index={1} label="Submissions" value={submissions.length} />
          <MetricCard index={2} label="Completion" value={submissions.length > 0 ? 92 : 0} suffix="%" />
          <MetricCard index={3} label="Status" value={form.status.toUpperCase()} />
          <MetricCard index={4} label="Created" value={formatDate(form.created_at).slice(0, 6)} />
        </div>

        {/* Main Details Panel */}
        <div className="relative bg-white border border-ink/25 p-6 sm:p-8 space-y-6 relative z-10">
          <CornerBrackets active />

          {!editingTitle ? (
            <EditableField
              id="form-title"
              label="Form Title"
              value={form.title}
              isEditing={false}
              onEdit={startEditTitle}
              onSave={saveTitle}
              onCancel={cancelEditTitle}
              onChange={setTitleDraft}
            />
          ) : (
            <EditableField
              id="form-title"
              label="Form Title"
              value={titleDraft}
              isEditing
              error={titleError}
              maxLength={255}
              onChange={setTitleDraft}
              onEdit={startEditTitle}
              onSave={saveTitle}
              onCancel={cancelEditTitle}
              isSaving={savingTitle}
            />
          )}

          <hr className="border-t border-ink/15" />

          {!editingDescription ? (
            <EditableField
              id="form-description"
              label="Description"
              value={form.description ?? ''}
              isEditing={false}
              multiline
              onEdit={startEditDesc}
              onSave={saveDesc}
              onCancel={cancelEditDesc}
              onChange={setDescDraft}
            />
          ) : (
            <EditableField
              id="form-description"
              label="Description"
              value={descDraft}
              isEditing
              multiline
              maxLength={2000}
              onChange={setDescDraft}
              onEdit={startEditDesc}
              onSave={saveDesc}
              onCancel={cancelEditDesc}
              isSaving={savingDesc}
            />
          )}

          {actionError && (
            <div className="p-3.5 bg-danger-tint border border-danger/40 text-danger font-mono text-xs flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{actionError}</span>
            </div>
          )}

          {/* Action Row */}
          <div className="pt-4 border-t border-ink/15 space-y-3">
            <h3 className="font-mono text-[10.5px] uppercase tracking-wider text-slate">FORM MANAGEMENT ACTIONS</h3>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button variant="primary" size="sm" onClick={() => navigate(`/forms/${id}/build`)}>
                <Wrench size={14} /> Open Builder
              </Button>

              {form.status === 'published' ? (
                <Button variant="secondary" size="sm" onClick={handleUnpublish} isLoading={isPublishing}>
                  <Send size={14} /> Unpublish Form
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={handlePublish} isLoading={isPublishing}>
                  <Send size={14} /> Publish Form
                </Button>
              )}

              {form.status !== 'archived' && (
                <Button variant="secondary" size="sm" onClick={handleArchive} isLoading={isArchiving}>
                  <Archive size={14} /> Archive Form
                </Button>
              )}

              <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={14} /> Delete Form
              </Button>
            </div>
          </div>

          {/* Sharing Settings Panel */}
          <div className="border border-ink/20 bg-cream-soft p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink/15 pb-3">
              <div>
                <h3 className="font-display font-bold text-sm uppercase text-ink">Sharing Settings</h3>
                <p className="text-xs text-slate">Configure privacy, share link, and email invites.</p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={form.access_mode === 'public' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => handleAccessModeChange('public')}
                >
                  Public Link
                </Button>
                <Button
                  type="button"
                  variant={form.access_mode === 'invite_only' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => handleAccessModeChange('invite_only')}
                >
                  Invite Only
                </Button>
              </div>
            </div>

            {form.access_mode === 'public' ? (
              <div className="space-y-3">
                {shareUrl ? (
                  <div className="space-y-2">
                    <label className="block font-mono text-[10.5px] uppercase tracking-wider text-slate">Public Form URL</label>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={shareUrl}
                        className="flex-1 border border-ink/30 bg-white px-3 py-2 text-xs font-mono text-ink"
                      />
                      <Button variant="secondary" size="sm" onClick={copyShareUrl}>
                        <Copy size={13} /> Copy Link
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => setIsShareEmailModalOpen(true)}>
                        <Mail size={13} /> Share via Email
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs italic text-slate">Publish form to generate a public link.</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <form onSubmit={handleCreateInvites} className="space-y-3">
                  <div>
                    <label className="block font-mono text-[10.5px] uppercase tracking-wider text-slate mb-1">
                      Invite Respondents (Comma or newline separated emails)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="respondent1@example.com, respondent2@example.com..."
                      value={inviteEmails}
                      onChange={(e) => setInviteEmails(e.target.value)}
                      className="w-full border border-ink/30 bg-white px-3 py-2 text-xs text-ink outline-none focus:border-cyan-dark font-mono resize-none"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <label className="text-slate">Max Uses:</label>
                      <input
                        type="number"
                        min={1}
                        value={inviteMaxUses}
                        onChange={(e) => setInviteMaxUses(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 border border-ink/30 bg-white px-2 py-1 text-xs text-ink font-bold"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" variant="primary" size="sm" isLoading={creatingInvites}>
                        Generate Invites
                      </Button>
                      <Button type="button" variant="secondary" size="sm" onClick={() => setIsShareEmailModalOpen(true)}>
                        <Mail size={13} /> Email Invites
                      </Button>
                    </div>
                  </div>
                  {inviteError && <p className="font-mono text-xs text-danger">{inviteError}</p>}
                </form>

                {/* Active Invites Table */}
                {invites.length > 0 && (
                  <div className="border border-ink/20 bg-white overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-ink/20 bg-cream-soft text-slate">
                          <th className="p-2.5">EMAIL</th>
                          <th className="p-2.5">USES</th>
                          <th className="p-2.5">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invites.map((inv) => (
                          <tr key={inv.id} className="border-b border-ink/10">
                            <td className="p-2.5 truncate max-w-[140px]">{inv.email}</td>
                            <td className="p-2.5">{inv.use_count} / {inv.max_uses}</td>
                            <td className="p-2.5 flex gap-1.5">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => copyInviteLink(inv.invite_link, inv.id)}
                                className="text-[10px] py-0.5 px-2"
                              >
                                {inviteCopiedId === inv.id ? 'Copied' : 'Copy Link'}
                              </Button>
                              <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                onClick={() => handleDeleteInvite(inv.id)}
                                className="text-[10px] py-0.5 px-2"
                              >
                                Revoke
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Schedule & Duplicate Response Settings */}
          <FormScheduleDuplicateSettings
            form={form}
            onUpdate={setForm}
            onError={(msg) => setActionError(msg)}
          />

          {/* Pending Duplicate Override Requests (Surfaced only when duplicate_policy is 'block') */}
          <DuplicateOverridePanel
            formId={form.id}
            duplicatePolicy={form.duplicate_policy || 'allow'}
          />

          {/* Submissions Section */}
          <section className="space-y-4 pt-6 border-t border-ink/15">
            <SubmissionsView
              form={form}
              submissions={submissions}
              onRefresh={loadForm}
            />
          </section>
        </div>
      </main>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Form"
        message={`Are you sure you want to delete "${form.title}"? All versions and submissions will be permanently deleted.`}
        confirmLabel="Delete Form"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {form && (
        <ShareEmailModal
          isOpen={isShareEmailModalOpen}
          form={form}
          publicUrl={shareUrl}
          onClose={() => setIsShareEmailModalOpen(false)}
          onScheduled={loadScheduledEmails}
        />
      )}
    </div>
  );
};

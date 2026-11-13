import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormSidebar } from '@/components/FormSidebar';
import { MetricCard } from '@/components/MetricCard';
import { CornerBrackets } from '@/components/CornerBrackets';
import { BlueprintLayer } from '@/components/BlueprintLayer';
import { Form, FormUpdatePayload } from '@/types/form';
import { getFormById, updateForm, archiveForm, deleteForm, publishForm, unpublishForm, getPublishedFormLink, getFormSubmissions, type FormSubmission } from '@/api/forms';
import { FormInvite, listInvites, createInvites, deleteInvite } from '@/api/invites';
import { exportSubmissions, type ExportFormat } from '@/api/export';
import { listScheduledEmails, type ScheduledEmailShare } from '@/api/scheduledEmails';

import {
  ArrowLeft,
  Pencil,
  Check,
  X,
  Archive,
  Trash2,
  AlertCircle,
  Wrench,
  Copy,
  Send,
  BarChart2,
  Download,
  Mail,
  Sparkles,
  Share2,
  Shield,
} from 'lucide-react';

import { ShareEmailModal } from '@/components/ShareEmailModal';
import { SubmissionsView } from '@/components/SubmissionsView';
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
            <label htmlFor={id} className="block font-mono text-[10px] uppercase tracking-wider text-ink-muted">
              {label}
            </label>
            <textarea
              id={id}
              rows={3}
              autoFocus
              value={value}
              maxLength={maxLength}
              onChange={(e) => onChange(e.target.value)}
              className="w-full border border-paper-border bg-paper-lowest px-3 py-2 text-xs text-ink outline-none focus:border-terracotta resize-none font-sans rounded-sm"
            />
          </div>
        ) : (
          <Input
            id={id}
            label={label}
            value={value}
            maxLength={maxLength}
            error={error}
            onChange={(e) => onChange(e.target.value)}
            autoFocus
            />
        )}
        {maxLength && (
          <p className="text-[10px] font-mono text-ink-muted text-right">
            {value.length}/{maxLength}
          </p>
        )}
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" onClick={onSave} isLoading={isSaving} className="gap-1 bg-terracotta text-white hover:bg-terracotta-hover">
            <Check className="w-3.5 h-3.5" />
            <span>Save</span>
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel} disabled={isSaving} className="gap-1 border-paper-border">
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative border border-transparent hover:border-paper-border p-2.5 -mx-2.5 rounded-sm transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-muted">
            {label}
          </span>
          <p className={`text-ink ${multiline ? 'text-xs leading-relaxed font-sans' : 'text-lg font-serif font-bold'}`}>
            {value || <span className="italic text-ink-subtle text-xs font-normal">No details provided</span>}
          </p>
        </div>
        <button
          onClick={onEdit}
          aria-label={`Edit ${label}`}
          className="opacity-0 group-hover:opacity-100 p-1 border border-paper-border bg-paper-lowest text-ink-muted hover:text-ink transition-all shrink-0 cursor-pointer rounded-sm"
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

  const [invites, setInvites] = useState<FormInvite[]>([]);
  const [inviteEmails, setInviteEmails] = useState('');
  const [inviteMaxUses, setInviteMaxUses] = useState(1);
  const [creatingInvites, setCreatingInvites] = useState(false);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteCopiedId, setInviteCopiedId] = useState<number | null>(null);
  const [isShareEmailModalOpen, setIsShareEmailModalOpen] = useState(false);

  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmailShare[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);

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

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      prompt('Copy this link:', shareUrl);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return iso; }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper-base text-ink">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <div className="w-8 h-8 border-2 border-terracotta border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-mono text-[11px] text-ink-muted">LOADING FORM LEDGER...</p>
        </div>
      </div>
    );
  }

  if (isForbidden || isNotFound || fetchError) {
    return (
      <div className="min-h-screen bg-paper-base text-ink">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <div className="border border-dashed border-paper-border bg-paper-lowest p-8 rounded-md space-y-4">
            <AlertCircle className="w-6 h-6 text-terracotta mx-auto mb-2" />
            <h2 className="font-serif font-bold text-xl">{fetchError || (isForbidden ? 'Access Denied' : 'Form Not Found')}</h2>
            <Link to="/forms">
              <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1.5" /> Back to My Forms</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="min-h-screen bg-paper-base text-ink relative transition-colors duration-200">
      <Navbar />

      <div className="flex-1 flex max-w-7xl w-full mx-auto overflow-hidden">
        <FormSidebar
          formId={id}
          title={form.title}
          status={form.status}
          responseCount={submissions.length}
          activePage="submissions"
        />
        <main className="flex-1 px-4 sm:px-8 py-8 sm:py-10 space-y-8 overflow-y-auto">
        <BlueprintLayer />

        {/* 1. Header Section matching reference image */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3 font-mono text-xs select-none">
              <span className="text-ink-muted">FRM-{String(form.id).padStart(4, '0')}</span>
              <StatusBadge status={form.status} />
              <span className="text-ink-subtle">Created {formatDate(form.created_at)}</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-ink">
              {form.title}
            </h1>
          </div>

          {/* Action Row - small h-8 buttons matching reference */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportSubmissions(id, 'csv')}
              className="h-8 text-xs border-paper-border text-ink hover:border-terracotta gap-1.5"
            >
              <Download size={13} /> Export CSV
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/forms/${id}/build`)}
              className="h-8 text-xs border-paper-border text-ink hover:border-terracotta gap-1.5"
            >
              <Wrench size={13} /> Open in Builder
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/forms/${id}/ai-analysis`)}
              className="h-8 text-xs bg-sage-fixed text-sage border border-sage-container hover:bg-sage-container/40 gap-1.5 font-medium"
            >
              <Sparkles size={13} /> AI Analysis
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/forms/${id}/analytics`)}
              className="h-8 text-xs border-paper-border text-ink hover:border-terracotta gap-1.5"
            >
              <BarChart2 size={13} /> Analytics
            </Button>
          </div>
        </div>

        {/* 2. Metric Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 relative z-10">
          <MetricCard index={1} label="Submissions" value={submissions.length} />
          <MetricCard index={2} label="Completion" value={submissions.length > 0 ? 92 : 0} suffix="%" />
          <MetricCard index={3} label="Status" value={form.status.toUpperCase()} />
          <MetricCard index={4} label="Created" value={formatDate(form.created_at).slice(0, 6)} />
        </div>

        {actionError && (
          <div className="p-3.5 bg-brick-container/70 border border-brick-border text-brick font-mono text-xs flex items-center gap-2 rounded-sm relative z-10">
            <AlertCircle size={15} />
            <span>{actionError}</span>
          </div>
        )}

        {/* 3. Three-Column Main Panel matching reference screenshot */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">

          {/* COLUMN 1: Form Ledger Details */}
          <div className="relative bg-paper-lowest border border-paper-border rounded-md p-6 space-y-6 shadow-warm-sm flex flex-col justify-between">
            <CornerBrackets />
            
            <div className="space-y-5">
              <div className="border-b border-paper-border pb-2">
                <span className="font-mono text-[10.5px] uppercase tracking-wider font-bold text-ink-muted">
                  FORM LEDGER DETAILS
                </span>
              </div>

              {/* Title inline edit */}
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

              {/* Description inline edit */}
              {!editingDescription ? (
                <EditableField
                  id="form-description"
                  label="Description Brief"
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
                  label="Description Brief"
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
            </div>

            {/* Administrative Actions - 2x2 grid */}
            <div className="pt-4 border-t border-paper-border space-y-3">
              <span className="block font-mono text-[10.5px] uppercase tracking-wider font-bold text-ink-muted">
                ADMINISTRATIVE ACTIONS
              </span>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/forms/${id}/build`)}
                  className="border-terracotta/40 text-terracotta hover:bg-terracotta-fixed font-medium text-xs h-9"
                >
                  Open Builder
                </Button>

                {form.status === 'published' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUnpublish}
                    isLoading={isPublishing}
                    className="border-paper-border text-ink hover:bg-paper-high font-medium text-xs h-9"
                  >
                    Unpublish
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePublish}
                    isLoading={isPublishing}
                    className="border-paper-border text-ink hover:bg-paper-high font-medium text-xs h-9"
                  >
                    Publish
                  </Button>
                )}

                {form.status !== 'archived' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleArchive}
                    isLoading={isArchiving}
                    className="border-paper-border text-ink hover:bg-paper-high font-medium text-xs h-9"
                  >
                    Archive
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="border-brick-border text-brick hover:bg-brick-container/50 font-medium text-xs h-9"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>

          {/* COLUMN 2: Distribution Protocol */}
          <div className="relative bg-paper-lowest border border-paper-border rounded-md p-6 space-y-5 shadow-warm-sm flex flex-col justify-between">
            <CornerBrackets />

            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-paper-border pb-2">
                <span className="font-mono text-[10.5px] uppercase tracking-wider font-bold text-ink-muted">
                  DISTRIBUTION PROTOCOL
                </span>
                <Share2 size={13} className="text-ink-muted" />
              </div>

              {/* Access Mode Segmented Control */}
              <div className="grid grid-cols-2 gap-2 bg-paper-high/50 p-1 rounded-sm">
                <button
                  type="button"
                  onClick={() => handleAccessModeChange('public')}
                  className={`py-1.5 text-xs font-sans font-semibold rounded-sm transition-all cursor-pointer ${
                    form.access_mode === 'public'
                      ? 'bg-paper-lowest text-ink shadow-warm-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Public Link
                </button>
                <button
                  type="button"
                  onClick={() => handleAccessModeChange('invite_only')}
                  className={`py-1.5 text-xs font-sans font-semibold rounded-sm transition-all cursor-pointer ${
                    form.access_mode === 'invite_only'
                      ? 'bg-paper-lowest text-ink shadow-warm-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Invite Only
                </button>
              </div>

              {form.access_mode === 'public' ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                      LIVE ENDPOINT URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={shareUrl || 'Publish form to generate live URL'}
                        className="flex-1 border border-paper-border bg-paper-high/40 px-2.5 py-1.5 text-xs font-mono text-ink rounded-sm truncate"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyShareUrl}
                        disabled={!shareUrl}
                        className="border-paper-border text-ink hover:border-terracotta shrink-0 text-xs px-3"
                      >
                        {copySuccess ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    fullWidth
                    onClick={() => setIsShareEmailModalOpen(true)}
                    className="border-paper-border text-ink hover:border-terracotta gap-1.5 py-2 text-xs"
                  >
                    <Mail size={13} className="text-terracotta" />
                    <span>Email Campaign Setup</span>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <form onSubmit={handleCreateInvites} className="space-y-2">
                    <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                      Invite Emails (comma separated)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="email1@example.com, email2@example.com..."
                      value={inviteEmails}
                      onChange={(e) => setInviteEmails(e.target.value)}
                      className="w-full border border-paper-border bg-paper-lowest px-2.5 py-1.5 text-xs text-ink outline-none focus:border-terracotta font-mono resize-none rounded-sm"
                    />
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <span className="text-ink-muted text-[10px]">Max Uses:</span>
                        <input
                          type="number"
                          min={1}
                          value={inviteMaxUses}
                          onChange={(e) => setInviteMaxUses(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-12 border border-paper-border bg-paper-lowest px-1.5 py-0.5 text-xs text-ink font-bold rounded-sm"
                        />
                      </div>
                      <Button type="submit" variant="primary" size="sm" isLoading={creatingInvites} className="text-xs bg-terracotta hover:bg-terracotta-hover text-white">
                        Send Invites
                      </Button>
                    </div>
                    {inviteError && <p className="font-mono text-[11px] text-brick">{inviteError}</p>}
                  </form>
                </div>
              )}
            </div>

            {/* Availability Schedule Sub-section */}
            <FormScheduleDuplicateSettings
              form={form}
              onUpdate={setForm}
              onError={(msg) => setActionError(msg)}
              section="schedule"
            />
          </div>

          {/* COLUMN 3: Integrity Rules */}
          <div className="relative bg-paper-lowest border border-paper-border rounded-md p-6 space-y-6 shadow-warm-sm flex flex-col justify-between">
            <CornerBrackets />

            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-paper-border pb-2">
                <span className="font-mono text-[10.5px] uppercase tracking-wider font-bold text-ink-muted">
                  INTEGRITY RULES
                </span>
                <Shield size={13} className="text-ink-muted" />
              </div>

              {/* Duplicate Response Policy & Field selector */}
              <FormScheduleDuplicateSettings
                form={form}
                onUpdate={setForm}
                onError={(msg) => setActionError(msg)}
                section="duplicate"
              />
            </div>

            {/* Override Requests Sub-section */}
            <DuplicateOverridePanel
              formId={form.id}
              duplicatePolicy={form.duplicate_policy || 'allow'}
            />
          </div>
        </div>

        {/* 4. Submissions Log Section matching reference */}
        <SubmissionsView
          form={form}
          submissions={submissions}
          onRefresh={loadForm}
        />
      </main>
      </div>

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
          onScheduled={() => {}}
        />
      )}
    </div>
  );
};

export default FormDetail;

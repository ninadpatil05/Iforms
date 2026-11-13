import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Form, FormUpdatePayload } from '@/types/form';
import { getFormById, updateForm, archiveForm, deleteForm, publishForm, unpublishForm, getPublishedFormLink, getFormSubmissions, type FormSubmission } from '@/api/forms';
import { downloadResponseFile } from '@/api/responseValues';
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
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Inline editable field
// ---------------------------------------------------------------------------

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
            <label htmlFor={id} className="block font-mono text-[10px] uppercase tracking-[0.14em] text-paper-muted">
              {label}
            </label>
            <textarea
              id={id}
              rows={4}
              autoFocus
              value={value}
              onChange={(e) => onChange(e.target.value)}
              maxLength={maxLength}
              className={`w-full px-3.5 py-2.5 rounded bg-transparent text-sm text-paper-text dark:text-paper-text-dark transition-all duration-160 ease-out outline-none resize-none
                ${error
                  ? 'border-2 border-paper-text dark:border-paper-text-dark'
                  : 'border border-paper-muted focus:border-paper-ink dark:focus:border-paper-text-dark'
                }`}
            />
            {error && <p className="font-mono text-[10px] uppercase tracking-wide text-paper-text dark:text-paper-text-dark">{error}</p>}
            {maxLength && (
              <p className="font-mono text-[10px] uppercase tracking-wide text-paper-muted">{value.length}/{maxLength}</p>
            )}
          </div>
        ) : (
          <Input
            id={id}
            label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            error={error}
            helperText={maxLength ? `${value.length}/${maxLength}` : undefined}
            maxLength={maxLength}
            autoFocus
          />
        )}
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={onSave} isLoading={isSaving} className="gap-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>Save</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
            <X className="w-3.5 h-3.5 mr-1" />
            <span>Cancel</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-muted mb-1">
          {label}
        </p>
        <p className={`text-sm leading-relaxed ${value ? 'text-paper-text dark:text-paper-text-dark' : 'text-paper-muted italic'}`}>
          {value || `No ${label.toLowerCase()} set`}
        </p>
      </div>
      <button
        onClick={onEdit}
        className="opacity-0 group-hover:opacity-100 transition-opacity duration-160 ease-out p-1.5 rounded text-paper-muted hover:text-paper-ink dark:hover:text-paper-text-dark flex-shrink-0"
        title={`Edit ${label}`}
      >
        <Pencil className="w-4 h-4" />
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// FormDetail Page
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const FormDetail: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();

  const [form, setForm] = useState<Form | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);
  const [isNotFound, setIsNotFound] = useState(false);

  // Edit states — title
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleError, setTitleError] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);

  // Edit states — description
  const [editingDescription, setEditingDescription] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [savingDesc, setSavingDesc] = useState(false);

  // Archive / Delete
  const [isArchiving, setIsArchiving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [expandedSubmission, setExpandedSubmission] = useState<number | null>(null);

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
      } else setShareUrl('');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) setIsForbidden(true);
      else if (status === 404) setIsNotFound(true);
      else setFetchError('Failed to load form. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadForm();
  }, [loadForm]);

  // ----- Title edit -----
  const startEditTitle = () => {
    setTitleDraft(form?.title ?? '');
    setTitleError('');
    setEditingTitle(true);
  };
  const cancelEditTitle = () => setEditingTitle(false);
  const saveTitle = async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed) { setTitleError('Title is required.'); return; }
    if (trimmed.length > 255) { setTitleError('Title must be 255 characters or fewer.'); return; }
    setSavingTitle(true);
    try {
      const payload: FormUpdatePayload = { title: trimmed };
      const updated = await updateForm(id, payload);
      setForm(updated);
      setEditingTitle(false);
    } catch {
      setTitleError('Failed to save. Please try again.');
    } finally {
      setSavingTitle(false);
    }
  };

  // ----- Description edit -----
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
      // Keep editing open with error feedback via actionError
      setActionError('Failed to save description. Please try again.');
    } finally {
      setSavingDesc(false);
    }
  };

  // ----- Archive -----
  const handleArchive = async () => {
    setIsArchiving(true);
    setActionError(null);
    try {
      const updated = await archiveForm(id);
      setForm(updated);
    } catch {
      setActionError('Failed to archive form. Please try again.');
    } finally {
      setIsArchiving(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true); setActionError(null);
    try { const result = await publishForm(id); setShareUrl(result.public_url); await loadForm(); }
    catch { setActionError('Could not publish this form. Please try again.'); }
    finally { setIsPublishing(false); }
  };
  const handleUnpublish = async () => {
    setIsPublishing(true); setActionError(null);
    try { await unpublishForm(id); setShareUrl(''); await loadForm(); }
    catch { setActionError('Could not unpublish this form. Please try again.'); }
    finally { setIsPublishing(false); }
  };
  const copyShareUrl = async () => {
    try { await navigator.clipboard.writeText(shareUrl); }
    catch { setActionError('Could not copy the link. Please copy it from the field instead.'); }
  };
  const downloadFile = async (responseId: number) => {
    try {
      const blob = await downloadResponseFile(responseId);
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'response-file'; link.click(); URL.revokeObjectURL(url);
    } catch { setActionError('Could not download the uploaded file.'); }
  };

  // ----- Delete -----
  const handleDelete = async () => {
    setIsDeleting(true);
    setActionError(null);
    try {
      await deleteForm(id);
      navigate('/forms', { replace: true });
    } catch {
      setActionError('Failed to delete form. Please try again.');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper-base dark:bg-paper-base-dark">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-16 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-8 h-8 border-2 border-paper-ink dark:border-paper-text-dark border-t-transparent rounded-full animate-spin" />
            <p className="font-mono text-[10px] uppercase tracking-wide text-paper-muted">Loading form…</p>
          </div>
        </div>
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div className="min-h-screen bg-paper-base dark:bg-paper-base-dark">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="rounded border border-dashed border-paper-muted p-10 text-center">
            <div className="w-12 h-12 rounded border border-paper-muted flex items-center justify-center mx-auto mb-4 text-paper-muted">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-semibold text-paper-text dark:text-paper-text-dark mb-2">Access Denied</h1>
            <p className="text-sm text-paper-muted mb-6 max-w-xs mx-auto">
              This form belongs to another user and cannot be accessed.
            </p>
            <Link to="/forms">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to My Forms
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="min-h-screen bg-paper-base dark:bg-paper-base-dark">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="rounded border border-dashed border-paper-muted p-10 text-center">
            <div className="w-12 h-12 rounded border border-paper-muted flex items-center justify-center mx-auto mb-4 text-paper-muted">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-semibold text-paper-text dark:text-paper-text-dark mb-2">Form Not Found</h1>
            <p className="text-sm text-paper-muted mb-6 max-w-xs mx-auto">
              This form doesn't exist or may have been deleted.
            </p>
            <Link to="/forms">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to My Forms
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-paper-base dark:bg-paper-base-dark">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="rounded border border-dashed border-paper-muted p-8 text-center">
            <AlertCircle className="w-6 h-6 text-paper-muted mx-auto mb-3" />
            <p className="text-sm font-medium text-paper-text dark:text-paper-text-dark mb-4">{fetchError}</p>
            <Button variant="secondary" onClick={loadForm} className="gap-2 mx-auto">
              <RefreshCw className="w-4 h-4" />
              <span>Retry</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="min-h-screen bg-paper-base dark:bg-paper-base-dark transition-colors duration-160 ease-out">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-12">

        {/* Breadcrumb */}
        <Link
          to="/forms"
          className="inline-flex items-center font-mono text-[10px] uppercase tracking-wide text-paper-muted hover:text-paper-ink dark:hover:text-paper-text-dark transition-colors duration-160 ease-out mb-6 group"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5 transition-transform group-hover:-translate-x-0.5" />
          My Forms
        </Link>

        {/* Form card */}
        <div className="rounded border border-paper-muted overflow-hidden">
          {/* Title block — blueprint drafting callout along the top edge */}
          <div className="border-b border-paper-muted px-6 sm:px-8 py-4 flex flex-wrap items-center gap-3">
            <StatusBadge status={form.status} />
            <span className="flex items-center font-mono text-[10px] uppercase tracking-[0.14em] text-paper-muted">
              <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
              Created {formatDate(form.created_at)}
            </span>
            {form.updated_at !== form.created_at && (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-muted">
                · Updated {formatDate(form.updated_at)}
              </span>
            )}
          </div>

          <div className="p-6 sm:p-8 space-y-6">

            {/* Title */}
            {!editingTitle ? (
              <EditableField
                id="form-title"
                label="Title"
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
                label="Title"
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

            {/* Description */}
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
                onChange={setDescDraft}
                onEdit={startEditDesc}
                onSave={saveDesc}
                onCancel={cancelEditDesc}
                isSaving={savingDesc}
              />
            )}

            {/* Action error */}
            {actionError && (
              <div className="flex items-start gap-2 rounded border border-paper-text dark:border-paper-text-dark px-4 py-3">
                <AlertCircle className="w-4 h-4 text-paper-text dark:text-paper-text-dark flex-shrink-0 mt-0.5" />
                <p className="text-sm text-paper-text dark:text-paper-text-dark">{actionError}</p>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-paper-muted" />

            {/* Actions */}
            <div className="space-y-3">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper-muted">
                Actions
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <Link to={`/forms/${id}/build`}>
                  <Button variant="primary" size="md" className="gap-2">
                    <Wrench className="w-4 h-4" />
                    <span>Build Form</span>
                  </Button>
                </Link>
                {form.status === 'published' ? (
                  <Button variant="outline" size="md" onClick={handleUnpublish} isLoading={isPublishing} className="gap-2">
                    <Send className="w-4 h-4" /><span>Unpublish</span>
                  </Button>
                ) : (
                  <Button variant="outline" size="md" onClick={handlePublish} isLoading={isPublishing} className="gap-2">
                    <Send className="w-4 h-4" /><span>Publish</span>
                  </Button>
                )}
                {form.status !== 'archived' && (
                  <Button
                    variant="outline"
                    size="md"
                    onClick={handleArchive}
                    isLoading={isArchiving}
                    className="gap-2"
                    id="archive-form-btn"
                  >
                    <Archive className="w-4 h-4" />
                    <span>Archive Form</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="gap-2"
                  id="delete-form-btn"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Form</span>
                </Button>
              </div>

              {shareUrl && (
                <div className="rounded border border-paper-muted p-4">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-paper-muted">Shareable public link</p>
                  <div className="flex gap-2">
                    <input readOnly value={shareUrl} className="min-w-0 flex-1 rounded border border-paper-muted bg-transparent px-3 py-2 text-sm text-paper-text dark:text-paper-text-dark" />
                    <Button variant="outline" size="sm" onClick={copyShareUrl}><Copy className="mr-1.5 h-4 w-4" />Copy link</Button>
                  </div>
                </div>
              )}

              <section className="space-y-3 border-t border-paper-muted pt-6">
                <div>
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper-muted">Responses</h3>
                  <p className="mt-1 text-sm text-paper-muted">{submissions.length} recorded response{submissions.length === 1 ? '' : 's'} across all published versions.</p>
                </div>
                {submissions.length === 0 ? (
                  <div className="border border-dashed border-paper-muted rounded p-6 text-center">
                    <p className="text-base font-semibold text-paper-text dark:text-paper-text-dark">The paper tray is empty.</p>
                    <p className="mt-1 text-sm text-paper-muted">Responses will appear here when someone submits your form.</p>
                  </div>
                ) : submissions.map((submission, index) => (
                  <div key={submission.id} className="paper-rise rounded border border-paper-muted" style={{ animationDelay: `${index * 40}ms` }}>
                    <button
                      type="button"
                      onClick={() => setExpandedSubmission(current => current === submission.id ? null : submission.id)}
                      className="flex w-full items-center justify-between gap-3 p-4 text-left"
                    >
                      <span>
                        <span className="block font-mono text-[10px] uppercase tracking-wide text-paper-muted">{submission.submitted_at ? formatDate(submission.submitted_at) : 'In progress'}</span>
                        <span className="mt-1 block text-sm font-semibold text-paper-text dark:text-paper-text-dark">Response #{submission.id}</span>
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-wide text-paper-muted">v{submission.version_number} · {expandedSubmission === submission.id ? 'close' : 'open'}</span>
                    </button>
                    {expandedSubmission === submission.id && (
                      <div className="space-y-3 border-t border-paper-muted p-4">
                        {submission.answers.map(answer => (
                          <div key={answer.id} className="grid gap-1 text-sm sm:grid-cols-[minmax(0,0.42fr)_1fr]">
                            <span className="font-medium text-paper-muted">{answer.field_label}</span>
                            {answer.file_download_url ? (
                              <button type="button" onClick={() => downloadFile(answer.id)} className="w-fit font-mono text-xs text-paper-ink dark:text-paper-text-dark underline underline-offset-4">Download uploaded file</button>
                            ) : (
                              <span className="break-words text-paper-text dark:text-paper-text-dark">{answer.value_text || '—'}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </section>

              {form.status === 'published' && (
                <div className="space-y-3 border-t border-paper-muted pt-6">
                  <div>
                    <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper-muted">Sharing</h3>
                    <p className="mt-1 text-sm text-paper-muted">Your public link stays stable as new versions are published.</p>
                  </div>
                </div>
              )}

              <p className="font-mono text-[10px] uppercase tracking-wide text-paper-muted">
                {form.status !== 'archived'
                  ? 'Archive hides the form from your list without permanently deleting it.'
                  : 'This form is archived. Delete will permanently remove it and all its data.'}
              </p>
            </div>
          </div>
        </div>
      </main>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Form"
        message={`"${form.title}" and all its versions will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete Permanently"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};

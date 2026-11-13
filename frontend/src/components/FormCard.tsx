import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form } from '@/types/form';
import { archiveForm, unarchiveForm, deleteForm, restoreForm, permanentDeleteForm } from '@/api/forms';
import { ConfirmDialog } from './ConfirmDialog';
import { IconButton, Button } from './Button';
import { Users, Clock, Edit2, Archive, Trash2, BarChart2, RotateCcw, AlertTriangle } from 'lucide-react';
import { useToast } from '@/context/ToastContext';

export interface FormCardProps {
  form: Form;
  onArchived?: (id: number) => void;
  onUnarchived?: (id: number) => void;
  onRestored?: (id: number) => void;
  onDeleted?: (id: number) => void;
  onPermanentDeleted?: (id: number) => void;
}

export const FormCard: React.FC<FormCardProps> = ({
  form,
  onArchived,
  onUnarchived,
  onRestored,
  onDeleted,
  onPermanentDeleted,
}) => {
  const navigate = useNavigate();
  const toast = useToast();

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isArchived = form.status === 'archived';
  const isPublished = form.status === 'published';
  const isDraft = form.status === 'draft';
  const isTrashed = form.status === 'trashed';

  const submissionCount = form.submission_count ?? 0;

  const getTimeAgo = () => {
    if (isArchived) return "Archived";
    if (isTrashed) return "7 days left";
    const date = new Date(form.updated_at || form.created_at);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  };

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await archiveForm(form.id);
      toast.info('Form archived', `"${form.title}" was moved to archives.`);
      onArchived?.(form.id);
    } catch {
      toast.error('Archive failed', 'Could not archive form.');
    }
  };

  const handleUnarchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await unarchiveForm(form.id);
      toast.success('Form unarchived', `"${form.title}" was restored to draft status.`);
      onUnarchived?.(form.id);
    } catch {
      toast.error('Unarchive failed', 'Could not unarchive form.');
    }
  };

  const handleRestoreFromTrash = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await restoreForm(form.id);
      toast.success('Form restored', `"${form.title}" was restored from Trash.`);
      onRestored?.(form.id);
    } catch {
      toast.error('Restore failed', 'Could not restore form.');
    }
  };

  const handleDeleteConfirmed = async () => {
    setIsDeleting(true);
    try {
      if (isTrashed) {
        await permanentDeleteForm(form.id);
        toast.success('Permanently deleted', `"${form.title}" was permanently removed.`);
        onPermanentDeleted?.(form.id);
      } else {
        await deleteForm(form.id);
        toast.info('Moved to Trash', `"${form.title}" moved to Trash window (7-day retention).`);
        onDeleted?.(form.id);
      }
    } catch {
      toast.error('Delete failed', 'Could not delete form.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <div
        onClick={() => !isTrashed && navigate(`/forms/${form.id}/build`)}
        className={`p-6 border rounded-md shadow-warm-sm transition-all duration-200 cursor-pointer flex flex-col justify-between group ${
          isTrashed
            ? 'bg-brick-container/30 border-brick-border/60 hover:border-brick cursor-default'
            : isArchived
            ? 'bg-paper-high/70 border-paper-border hover:bg-paper-high'
            : 'bg-paper-lowest border-paper-border hover:shadow-warm-md hover:border-terracotta/40'
        }`}
      >
        <div className="space-y-4">
          {/* Status Badge Top Row */}
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-semibold uppercase tracking-wider ${
                isPublished
                  ? 'bg-terracotta-fixed text-terracotta border border-terracotta/20'
                  : isDraft
                  ? 'bg-paper-high text-ink-muted border border-paper-border'
                  : isArchived
                  ? 'bg-paper-border text-ink-subtle'
                  : 'bg-brick-container text-brick border border-brick-border font-mono'
              }`}
            >
              {isPublished ? 'Published' : isDraft ? 'Draft' : isArchived ? 'Archived' : 'Trash (7 days left)'}
            </span>

            {/* Quick Actions */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              {!isTrashed && (
                <>
                  <IconButton
                    icon={Edit2}
                    size="sm"
                    label="Build / Edit form"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/forms/${form.id}/build`);
                    }}
                  />
                  <IconButton
                    icon={BarChart2}
                    size="sm"
                    label="Analytics"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/forms/${form.id}/analytics`);
                    }}
                  />
                </>
              )}

              {isArchived && (
                <IconButton
                  icon={RotateCcw}
                  size="sm"
                  label="Unarchive form"
                  onClick={handleUnarchive}
                />
              )}

              {!isArchived && !isTrashed && (
                <IconButton
                  icon={Archive}
                  size="sm"
                  label="Archive form"
                  onClick={handleArchive}
                />
              )}

              {isTrashed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRestoreFromTrash}
                  className="text-xs gap-1 py-1 px-2.5"
                >
                  <RotateCcw size={13} /> Restore
                </Button>
              )}

              <IconButton
                icon={Trash2}
                size="sm"
                label={isTrashed ? 'Permanently delete form' : 'Move to Trash'}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
              />
            </div>
          </div>

          {/* Title & Description */}
          <div>
            <h3 className="font-serif text-xl font-bold text-ink tracking-tight group-hover:text-terracotta transition-colors line-clamp-2">
              {form.title}
            </h3>
            <p className="text-xs text-ink-muted mt-2 leading-relaxed line-clamp-2">
              {form.description || 'Standardized intake form for responses and data collection.'}
            </p>
          </div>

          {/* Trashed Warning Banner */}
          {isTrashed && (
            <div className="p-2.5 rounded-sm bg-amber-container/60 border border-amber-border text-amber text-[11px] font-mono font-medium flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>In Trash: Permanently deleted after 7 days unless restored.</span>
            </div>
          )}
        </div>

        {/* Card Footer Divider & Stats */}
        <div className="pt-4 border-t border-paper-border mt-6 flex items-center justify-between text-xs text-ink-muted">
          <div className="flex items-center gap-1.5 font-sans">
            <Users size={14} className="text-ink-subtle" />
            <span className="font-medium text-ink">
              {submissionCount.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-sans">
            <Clock size={14} className="text-ink-subtle" />
            <span>{getTimeAgo()}</span>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog matching reference screenshot requirements */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={isTrashed ? 'Permanently Delete Form' : 'Move Form to Trash'}
        message={
          isTrashed
            ? `Are you sure you want to permanently delete "${form.title}"? This action CANNOT be undone and all ${submissionCount.toLocaleString()} submissions will be permanently wiped.`
            : `Move "${form.title}" to Trash? It will be held in your Trash window for 7 days before permanent deletion.`
        }
        confirmLabel={isTrashed ? 'Permanently Delete' : 'Move to Trash'}
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
};

export default FormCard;

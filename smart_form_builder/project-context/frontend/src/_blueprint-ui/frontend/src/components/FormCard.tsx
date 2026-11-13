import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form } from '@/types/form';
import { archiveForm, deleteForm } from '@/api/forms';
import { StatusBadge } from './StatusBadge';
import { ConfirmDialog } from './ConfirmDialog';
import { Button } from './Button';
import { Pencil, Archive, Trash2 } from 'lucide-react';

interface FormCardProps {
  form: Form;
  onArchived: (id: number) => void;
  onDeleted: (id: number) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const FormCard: React.FC<FormCardProps> = ({ form, onArchived, onDeleted }) => {
  const navigate = useNavigate();
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = useCallback(() => {
    navigate(`/forms/${form.id}`);
  }, [navigate, form.id]);

  const handleArchive = useCallback(async () => {
    setArchiving(true);
    setError(null);
    try {
      await archiveForm(form.id);
      onArchived(form.id);
    } catch {
      setError('Failed to archive. Please try again.');
    } finally {
      setArchiving(false);
    }
  }, [form.id, onArchived]);

  const handleDeleteConfirmed = useCallback(async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteForm(form.id);
      onDeleted(form.id);
    } catch {
      setError('Failed to delete. Please try again.');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [form.id, onDeleted]);

  const isArchived = form.status === 'archived';

  return (
    <>
      <div
        className={`paper-rise group relative rounded border border-paper-muted bg-transparent hover:border-paper-ink dark:hover:border-paper-text-dark transition-all duration-160 ease-out flex flex-col ${isArchived ? 'opacity-60' : ''}`}
      >
        <div className="p-5 flex-1 flex flex-col">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3 className="font-semibold text-lg text-paper-text dark:text-paper-text-dark truncate leading-tight flex-1 min-w-0">
              {form.title}
            </h3>
            <StatusBadge status={form.status} />
          </div>

          {/* Description */}
          <p className="text-sm text-paper-muted leading-relaxed line-clamp-2 flex-1 mb-4">
            {form.description || <span className="italic">No description</span>}
          </p>

          {/* Date stamp — drafting date-stamp, bottom corner */}
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-muted mb-4">
            Created {formatDate(form.created_at)}
          </div>

          {/* Error */}
          {error && (
            <p className="font-mono text-[10px] uppercase tracking-wide text-paper-text dark:text-paper-text-dark mb-3">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleEdit}
              className="flex-1 gap-1.5"
              id={`edit-form-${form.id}`}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit</span>
            </Button>

            {!isArchived && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleArchive}
                isLoading={archiving}
                title="Archive this form"
                id={`archive-form-${form.id}`}
              >
                <Archive className="w-3.5 h-3.5" />
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete this form"
              id={`delete-form-${form.id}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Form"
        message={`"${form.title}" and all its versions will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleting}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
};

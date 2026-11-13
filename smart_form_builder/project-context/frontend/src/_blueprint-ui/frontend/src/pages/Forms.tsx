import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { FormCard } from '@/components/FormCard';
import { Form } from '@/types/form';
import { getMyForms, createForm } from '@/api/forms';
import { PlusCircle, FileText, X, AlertCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Create Form Modal (inline — no extra routing needed)
// ---------------------------------------------------------------------------

interface CreateFormModalProps {
  onClose: () => void;
  onCreated: (form: Form) => void;
}

const CreateFormModal: React.FC<CreateFormModalProps> = ({ onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [titleError, setTitleError] = useState('');

  const validate = (): boolean => {
    if (!title.trim()) {
      setTitleError('Title is required.');
      return false;
    }
    if (title.trim().length > 255) {
      setTitleError('Title must be 255 characters or fewer.');
      return false;
    }
    setTitleError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const form = await createForm({
        title: title.trim(),
        description: description.trim() || null,
      });
      onCreated(form);
    } catch {
      setTitleError('Failed to create form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-paper-base-dark/50 bp-fade-in" onClick={onClose} aria-hidden="true" />
      <div className="bp-fade-in relative z-10 w-full max-w-md rounded border border-paper-muted bg-paper-base dark:bg-paper-base-dark">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-paper-text dark:text-paper-text-dark">New Form</h2>
            <p className="font-mono text-[10px] uppercase tracking-wide text-paper-muted mt-1">
              Fill in the details to create your form
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-paper-muted hover:text-paper-ink dark:hover:text-paper-text-dark transition-colors duration-160 ease-out"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
          <Input
            id="new-form-title"
            label="Title"
            type="text"
            placeholder="e.g. Customer Feedback Survey"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (titleError) setTitleError('');
            }}
            error={titleError}
            helperText={`${title.length}/255`}
            maxLength={255}
            autoFocus
            required
          />
          <div>
            {/* Textarea for description — not using Input since it's not a text input */}
            <label
              htmlFor="new-form-description"
              className="block font-mono text-[10px] uppercase tracking-[0.14em] text-paper-muted mb-1.5"
            >
              Description <span className="normal-case text-paper-muted/70">(optional)</span>
            </label>
            <textarea
              id="new-form-description"
              rows={3}
              className="w-full px-3.5 py-2.5 rounded border border-paper-muted bg-transparent text-sm text-paper-text dark:text-paper-text-dark transition-all duration-160 ease-out outline-none resize-none focus:border-paper-ink dark:focus:border-paper-text-dark"
              placeholder="Briefly describe this form's purpose…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <Button type="button" variant="outline" size="md" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
              Create Form
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Forms Page
// ---------------------------------------------------------------------------

export const Forms: React.FC = () => {
  const [forms, setForms] = useState<Form[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadForms = useCallback(async (withArchived: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMyForms(withArchived);
      setForms(data);
    } catch {
      setError('Could not load your forms. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadForms(includeArchived);
  }, [loadForms, includeArchived]);

  const handleCreated = useCallback((form: Form) => {
    setForms((prev) => [form, ...prev]);
    setShowCreateModal(false);
  }, []);

  const handleArchived = useCallback((id: number) => {
    if (!includeArchived) {
      // Remove from list when not showing archived
      setForms((prev) => prev.filter((f) => f.id !== id));
    } else {
      // Update status in-place
      setForms((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: 'archived' as const } : f))
      );
    }
  }, [includeArchived]);

  const handleDeleted = useCallback((id: number) => {
    setForms((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return (
    <div className="min-h-screen bg-paper-base dark:bg-paper-base-dark transition-colors duration-160 ease-out">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-paper-text dark:text-paper-text-dark">
              My Forms
            </h1>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-paper-muted">
              {isLoading
                ? 'Loading'
                : `${forms.length} form${forms.length !== 1 ? 's' : ''}${includeArchived ? ' · including archived' : ''}`}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Include archived toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div className="relative">
                <input
                  id="include-archived-toggle"
                  type="checkbox"
                  className="sr-only peer"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                />
                <div className="w-9 h-5 rounded-full border border-paper-muted bg-transparent peer-checked:bg-paper-ink peer-checked:border-paper-ink transition-colors duration-160 ease-out" />
                <div className="absolute left-0.5 top-0.5 w-3.5 h-3.5 rounded-full bg-paper-muted peer-checked:bg-paper-base transition-transform duration-160 ease-out peer-checked:translate-x-4" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wide text-paper-muted">
                Show archived
              </span>
            </label>

            <Button
              variant="primary"
              size="md"
              onClick={() => setShowCreateModal(true)}
              id="new-form-button"
              className="gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Form</span>
            </Button>
          </div>
        </div>

        {/* Error state */}
        {error && !isLoading && (
          <div className="flex items-start gap-3 rounded border border-paper-text dark:border-paper-text-dark p-4 mb-8">
            <AlertCircle className="w-4 h-4 text-paper-text dark:text-paper-text-dark flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-paper-text dark:text-paper-text-dark">{error}</p>
              <button
                onClick={() => loadForms(includeArchived)}
                className="font-mono text-[10px] uppercase tracking-wide text-paper-muted underline mt-1 hover:no-underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded border border-paper-muted p-5 animate-pulse"
              >
                <div className="flex justify-between mb-3">
                  <div className="h-5 bg-paper-muted/20 rounded w-2/3" />
                  <div className="h-5 bg-paper-muted/20 rounded w-16" />
                </div>
                <div className="h-3 bg-paper-muted/20 rounded w-full mb-2" />
                <div className="h-3 bg-paper-muted/20 rounded w-3/4 mb-5" />
                <div className="h-3 bg-paper-muted/20 rounded w-1/3 mb-4" />
                <div className="flex gap-2">
                  <div className="h-8 bg-paper-muted/20 rounded flex-1" />
                  <div className="h-8 bg-paper-muted/20 rounded w-8" />
                  <div className="h-8 bg-paper-muted/20 rounded w-8" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && forms.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-paper-muted rounded">
            <div className="w-14 h-14 rounded border border-paper-muted flex items-center justify-center mb-4 text-paper-muted">
              <FileText className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold text-paper-text dark:text-paper-text-dark mb-2">
              {includeArchived ? 'No forms yet' : 'No active forms'}
            </h2>
            <p className="text-sm text-paper-muted max-w-xs leading-relaxed mb-6">
              {includeArchived
                ? 'Create your first form to get started collecting responses.'
                : 'All your forms may be archived. Toggle "Show archived" or create a new form.'}
            </p>
            <Button variant="primary" onClick={() => setShowCreateModal(true)} className="gap-2">
              <PlusCircle className="w-4 h-4" />
              <span>Create your first form</span>
            </Button>
          </div>
        )}

        {/* Forms grid */}
        {!isLoading && !error && forms.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {forms.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                onArchived={handleArchived}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Form Modal */}
      {showCreateModal && (
        <CreateFormModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
};

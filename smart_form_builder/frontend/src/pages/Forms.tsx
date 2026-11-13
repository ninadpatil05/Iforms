import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { FormCard } from '@/components/FormCard';
import { CreateFormModal } from '@/components/CreateFormModal';
import { Skeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Form } from '@/types/form';
import { getMyForms } from '@/api/forms';
import { Plus, Search, Filter, FileText, Trash2, Sparkles } from 'lucide-react';

export const Forms: React.FC = () => {
  const navigate = useNavigate();
  const [forms, setForms] = useState<Form[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchForms = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMyForms(true);
      setForms(data);
    } catch {
      setError('Failed to load forms. Please check backend connection.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  const handleFormCreated = (newForm: Form) => {
    setForms((prev) => [newForm, ...prev]);
  };

  const handleFormArchived = (id: number) => {
    setForms((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: 'archived' as const } : f))
    );
  };

  const handleFormUnarchived = (id: number) => {
    setForms((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: 'draft' as const } : f))
    );
  };

  const handleFormRestored = (id: number) => {
    setForms((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: 'draft' as const } : f))
    );
  };

  const handleFormTrashed = (id: number) => {
    setForms((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: 'trashed' as const } : f))
    );
  };

  const handleFormPermanentDeleted = (id: number) => {
    setForms((prev) => prev.filter((f) => f.id !== id));
  };

  // Filter forms based on search query and status filter
  const filteredForms = forms.filter((form) => {
    const matchesSearch =
      form.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (form.description && form.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      `frm-${form.id}`.includes(searchQuery.toLowerCase());

    if (statusFilter === 'all') {
      return matchesSearch && form.status !== 'trashed';
    }

    const matchesStatus = form.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const statusSelectOptions = [
    { value: 'all', label: 'All Active Forms' },
    { value: 'published', label: 'Published' },
    { value: 'draft', label: 'Draft' },
    { value: 'archived', label: 'Archived' },
    { value: 'trashed', label: 'Trash (7-Day Retention)' },
  ];

  const trashedCount = forms.filter((f) => f.status === 'trashed').length;

  return (
    <div className="min-h-screen bg-paper-base text-ink flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-paper-border pb-6">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-ink">
              My Forms
            </h1>
            <p className="text-sm text-ink-muted mt-1.5 leading-relaxed">
              Manage and track your active campaigns, archived surveys, and trash window.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant={statusFilter === 'trashed' ? 'secondary' : 'outline'}
              size="md"
              onClick={() => setStatusFilter(statusFilter === 'trashed' ? 'all' : 'trashed')}
              leftIcon={<Trash2 size={16} />}
            >
              Trash Window {trashedCount > 0 && `(${trashedCount})`}
            </Button>

            <Button
              variant="outline"
              size="md"
              onClick={() => navigate('/ai/generate')}
              leftIcon={<Sparkles size={18} className="text-accent" />}
            >
              Create with AI
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={() => setIsCreateModalOpen(true)}
              leftIcon={<Plus size={18} />}
            >
              Create New Form
            </Button>
          </div>
        </div>

        {/* Search, Filter Controls Row matching my_forms reference screenshot */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <Input
              placeholder="Search forms by title or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              leftIcon={<Search size={16} />}
            />
          </div>

          <div className="w-full sm:w-56">
            <Select
              options={statusSelectOptions}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              searchable={false}
              clearable={false}
            />
          </div>

          <Button
            variant="outline"
            size="md"
            leftIcon={<Filter size={16} />}
            className="w-full sm:w-auto"
          >
            Filters
          </Button>
        </div>

        {/* Error State */}
        {error && !isLoading && (
          <div className="p-4 rounded-md bg-brick-container border border-brick-border text-brick text-sm flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={fetchForms}>
              Retry
            </Button>
          </div>
        )}

        {/* Loading Skeleton Grid */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="card" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredForms.length === 0 && (
          <EmptyState
            icon={statusFilter === 'trashed' ? Trash2 : FileText}
            title={
              statusFilter === 'trashed'
                ? 'Trash Window is Empty'
                : searchQuery
                ? 'No forms match your search'
                : 'No forms created yet'
            }
            description={
              statusFilter === 'trashed'
                ? 'Deleted forms will be held here for 7 days before permanent cleanup.'
                : searchQuery
                ? 'Try adjusting your search criteria or status filter.'
                : 'Get started by creating your first form to collect responses.'
            }
            primaryAction={
              statusFilter === 'trashed' ? (
                <Button variant="outline" onClick={() => setStatusFilter('all')}>
                  View Active Forms
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => setIsCreateModalOpen(true)}
                  leftIcon={<Plus size={16} />}
                >
                  Create New Form
                </Button>
              )
            }
          />
        )}

        {/* Forms Card Grid */}
        {!isLoading && !error && filteredForms.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredForms.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                onArchived={handleFormArchived}
                onUnarchived={handleFormUnarchived}
                onRestored={handleFormRestored}
                onDeleted={handleFormTrashed}
                onPermanentDeleted={handleFormPermanentDeleted}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer Bar */}
      <footer className="mt-12 border-t border-paper-border bg-paper-lowest py-8 text-xs text-ink-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <span className="font-serif font-bold text-lg text-terracotta">IForms</span>
            <div className="hidden sm:flex items-center gap-4 text-ink-muted">
              <a href="#privacy" className="hover:text-ink no-underline">
                Privacy Policy
              </a>
              <a href="#terms" className="hover:text-ink no-underline">
                Terms of Service
              </a>
              <a href="#support" className="hover:text-ink no-underline">
                Contact Support
              </a>
              <a href="#twitter" className="hover:text-ink no-underline">
                Twitter
              </a>
              <a href="#linkedin" className="hover:text-ink no-underline">
                LinkedIn
              </a>
            </div>
          </div>

          <p>© 2026 IForms Editorial Systems. All rights reserved.</p>
        </div>
      </footer>

      {/* Create Form Modal */}
      <CreateFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleFormCreated}
      />
    </div>
  );
};

export default Forms;

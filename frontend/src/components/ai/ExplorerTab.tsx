import React, { useState, useEffect, useCallback } from 'react';
import { FormSubmission, getFormSubmissions } from '@/api/forms';
import {
  updateSubmissionCategorization,
  resetFormVersionCategorizations,
} from '@/api/aiAnalysis';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CornerBrackets } from '@/components/CornerBrackets';
import {
  Search,
  RefreshCw,
  Pencil,
  ChevronDown,
  ChevronUp,
  Filter,
  ArrowUpDown,
  CheckCircle2,
} from 'lucide-react';

interface ExplorerTabProps {
  formId: number;
  formVersionId: number;
}

export const ExplorerTab: React.FC<ExplorerTabProps> = ({ formId, formVersionId }) => {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('submitted_at');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [updatingSubId, setUpdatingSubId] = useState<number | null>(null);

  const fetchSubmissions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getFormSubmissions(formId, {
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        status_filter: statusFilter !== 'all' ? statusFilter : undefined,
        search: search.trim() || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        limit: 100,
      });
      setSubmissions(data);
    } catch {
      setSubmissions([]);
    } finally {
      setIsLoading(false);
    }
  }, [formId, categoryFilter, statusFilter, search, sortBy, sortOrder]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleCategoryChange = async (
    submissionId: number,
    newCategory: 'useful' | 'not_useful' | 'uncategorized'
  ) => {
    setUpdatingSubId(submissionId);
    try {
      const updatedCat = await updateSubmissionCategorization(submissionId, newCategory);
      setSubmissions((prev) =>
        prev.map((sub) =>
          sub.id === submissionId
            ? {
                ...sub,
                category: updatedCat.category,
                author_overridden: updatedCat.author_overridden,
                ai_suggested_category: updatedCat.ai_suggested_category,
              }
            : sub
        )
      );
    } catch {
      alert('Failed to update categorization.');
    } finally {
      setUpdatingSubId(null);
    }
  };

  const handleResetConfirm = async () => {
    setIsResetting(true);
    try {
      await resetFormVersionCategorizations(formVersionId);
      await fetchSubmissions();
      setShowResetConfirm(false);
    } catch {
      alert('Failed to reset categorizations.');
    } finally {
      setIsResetting(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return 'Pending';
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const renderCategoryBadge = (cat?: string, overridden?: boolean) => {
    const norm = (cat || 'uncategorized').toLowerCase();
    let badgeStyle = 'bg-paper-high text-ink-muted border-paper-border';
    if (norm === 'useful') {
      badgeStyle = 'bg-forest-container text-forest border-forest-border/40';
    } else if (norm === 'not_useful') {
      badgeStyle = 'bg-brick-container text-brick border-brick-border/40';
    }

    return (
      <div className="inline-flex items-center gap-1">
        <span
          className={`px-2.5 py-0.5 rounded-full border font-mono text-[10px] font-bold uppercase tracking-wider ${badgeStyle}`}
        >
          {norm.replace('_', ' ')}
        </span>
        {overridden && (
          <span title="Manually overridden by author">
            <Pencil size={11} className="text-terracotta shrink-0" />
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm p-6 sm:p-8 space-y-6 relative">
      <CornerBrackets />

      {/* Header & Controls Bar */}
      <div className="space-y-4 border-b border-paper-border pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-2xl font-bold tracking-tight text-ink">
              AI Response Explorer
            </h3>
            <p className="text-xs text-ink-muted mt-0.5 font-mono">
              Server-filtered submissions with AI categorizations & manual author overrides.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowResetConfirm(true)}
            className="border-paper-border text-ink hover:border-terracotta gap-1.5 text-xs h-9 shrink-0"
          >
            <RefreshCw size={13} className="text-terracotta" />
            <span>Reset to AI Suggestions</span>
          </Button>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2">
          {/* Search */}
          <div className="md:col-span-2">
            <Input
              placeholder="Search respondent or answers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search size={14} />}
              className="bg-paper-high/40 text-xs"
            />
          </div>

          {/* Category Filter */}
          <div className="space-y-1">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full h-9 border border-paper-border bg-paper-lowest px-2.5 py-1 text-xs font-mono text-ink rounded-sm outline-none focus:border-terracotta"
            >
              <option value="all">All Categories</option>
              <option value="useful">Useful</option>
              <option value="not_useful">Not Useful</option>
              <option value="uncategorized">Uncategorized</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-9 border border-paper-border bg-paper-lowest px-2.5 py-1 text-xs font-mono text-ink rounded-sm outline-none focus:border-terracotta"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="in_progress">In Progress</option>
            </select>
          </div>

          {/* Sort By & Order */}
          <div className="flex gap-1">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="flex-1 h-9 border border-paper-border bg-paper-lowest px-2 py-1 text-xs font-mono text-ink rounded-sm outline-none focus:border-terracotta"
            >
              <option value="submitted_at">Submitted</option>
              <option value="started_at">Started</option>
              <option value="id">ID</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              className="h-9 px-2.5 border border-paper-border bg-paper-lowest text-ink hover:border-terracotta rounded-sm cursor-pointer"
              title={`Sort Order: ${sortOrder.toUpperCase()}`}
            >
              <ArrowUpDown size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Table Section */}
      {isLoading ? (
        <div className="py-12 text-center text-xs font-mono text-ink-muted italic">
          Loading filtered responses…
        </div>
      ) : submissions.length === 0 ? (
        <div className="py-12 text-center text-xs font-mono text-ink-muted italic border border-dashed border-paper-border rounded-md">
          No responses found matching your current filters.
        </div>
      ) : (
        <div className="space-y-1">
          {/* Table Header */}
          <div className="grid grid-cols-[80px_130px_1.2fr_130px_100px_120px] px-4 py-2.5 bg-paper-high/40 font-mono text-[10.5px] font-bold text-ink-muted uppercase border-b border-paper-border select-none">
            <span>ID</span>
            <span>DATE</span>
            <span>RESPONDENT</span>
            <span>CATEGORY</span>
            <span>STATUS</span>
            <span className="text-right">OVERRIDE</span>
          </div>

          {/* Rows */}
          {submissions.map((sub) => {
            const isExpanded = expandedId === sub.id;
            const submitter = sub.respondent_identifier || `Respondent #${sub.id}`;
            const isSubmitted = !sub.status || sub.status.toLowerCase() === 'submitted';

            return (
              <div key={sub.id} className="border-b border-paper-border/60 last:border-none">
                <div
                  onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                  className={`grid grid-cols-[80px_130px_1.2fr_130px_100px_120px] items-center px-4 py-3 text-xs cursor-pointer transition-colors ${
                    isExpanded ? 'bg-paper-high/50 font-medium' : 'hover:bg-paper-high/30'
                  }`}
                >
                  <span className="font-mono font-bold text-terracotta">#{sub.id}</span>
                  <span className="font-mono text-ink-muted text-[11px]">
                    {formatDate(sub.submitted_at)}
                  </span>
                  <span className="font-medium text-ink truncate pr-2">{submitter}</span>
                  <div>{renderCategoryBadge(sub.category, sub.author_overridden)}</div>
                  <div>
                    {isSubmitted ? (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-forest-container text-forest border border-forest-border/40 font-mono text-[10px] font-bold uppercase">
                        SUBMITTED
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-amber-container text-amber border border-amber-border/40 font-mono text-[10px] font-bold uppercase">
                        IN PROGRESS
                      </span>
                    )}
                  </div>

                  {/* Inline Category Change Dropdown */}
                  <div className="text-right" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={(sub.category || 'uncategorized').toLowerCase()}
                      disabled={updatingSubId === sub.id}
                      onChange={(e) =>
                        handleCategoryChange(
                          sub.id,
                          e.target.value as 'useful' | 'not_useful' | 'uncategorized'
                        )
                      }
                      className="text-[11px] font-mono border border-paper-border bg-paper-lowest px-2 py-1 rounded-sm text-ink outline-none focus:border-terracotta cursor-pointer"
                    >
                      <option value="uncategorized">Uncategorized</option>
                      <option value="useful">Useful</option>
                      <option value="not_useful">Not Useful</option>
                    </select>
                  </div>
                </div>

                {/* Expanded Answer Record Drawer */}
                {isExpanded && (
                  <div className="p-5 bg-paper-high/30 border-t border-paper-border space-y-4">
                    <div className="flex items-center justify-between border-b border-paper-border pb-3">
                      <div>
                        <h4 className="font-serif text-lg font-bold text-ink">
                          Submission Record #${sub.id}
                        </h4>
                        <p className="text-xs font-mono text-ink-muted">
                          {submitter} · AI Suggestion:{' '}
                          <strong className="text-ink">
                            {sub.ai_suggested_category || 'None'}
                          </strong>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedId(null)}
                        className="text-xs font-mono text-ink-muted hover:text-ink"
                      >
                        Close
                      </button>
                    </div>

                    <div className="bg-paper-lowest border border-paper-border rounded-md p-4 space-y-3 shadow-warm-sm">
                      {sub.answers.length === 0 ? (
                        <p className="text-xs text-ink-muted italic font-mono">
                          No answer data recorded.
                        </p>
                      ) : (
                        sub.answers.map((ans) => (
                          <div key={ans.id} className="space-y-1">
                            <label className="block text-[10px] font-mono font-bold text-ink-muted uppercase">
                              {ans.field_label}
                            </label>
                            <div className="p-2.5 bg-paper-high/40 border border-paper-border rounded-sm text-xs font-medium text-ink leading-relaxed">
                              {ans.value_text || <span className="italic text-ink-subtle">No response</span>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Dialog for Reset */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Reset to AI Suggestions"
        message="Are you sure you want to reset all categorizations to the AI's recommendations? Any manual author overrides will be cleared."
        confirmLabel="Reset Categorizations"
        cancelLabel="Cancel"
        isLoading={isResetting}
        onConfirm={handleResetConfirm}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
};

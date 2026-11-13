import React, { useState } from 'react';
import { Form } from '@/types/form';
import { FormSubmission } from '@/api/forms';
import { Button } from './Button';
import { Input } from './Input';
import { ConfirmDialog } from './ConfirmDialog';
import { exportSubmissions, ExportFormat } from '@/api/export';
import {
  Search,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileText,
  Trash2,
  CheckCircle2,
  ExternalLink,
  Printer,
  Mail,
  Star,
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';

export interface SubmissionsViewProps {
  form: Form;
  submissions: FormSubmission[];
  onDeleteSubmission?: (submissionId: number) => Promise<void>;
  onRefresh?: () => void;
}

export const SubmissionsView: React.FC<SubmissionsViewProps> = ({
  form,
  submissions,
  onDeleteSubmission,
  onRefresh,
}) => {
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'in_progress'>('all');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [subToDelete, setSubToDelete] = useState<FormSubmission | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filtered Submissions
  const filteredSubmissions = submissions.filter((sub) => {
    if (statusFilter !== 'all' && sub.status.toLowerCase() !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const subText = `${sub.id} ${sub.respondent_identifier || ''} ${sub.answers
      .map((a) => a.value_text || '')
      .join(' ')}`.toLowerCase();
    return subText.includes(query);
  });

  const handleExport = async (format: ExportFormat) => {
    setShowExportMenu(false);
    try {
      await exportSubmissions(form.id, format, {
        status_filter: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery || undefined,
      });
      toast.success('Export started', `Downloading submissions as ${format.toUpperCase()}.`);
    } catch {
      toast.error('Export failed', `Could not export submissions as ${format.toUpperCase()}.`);
    }
  };

  const handleConfirmDelete = async () => {
    if (!subToDelete || !onDeleteSubmission) return;
    setIsDeleting(true);
    try {
      await onDeleteSubmission(subToDelete.id);
      toast.info('Submission deleted', `Removed submission #${subToDelete.id}.`);
      setExpandedId(null);
    } catch {
      toast.error('Delete failed', 'Could not remove submission.');
    } finally {
      setIsDeleting(false);
      setSubToDelete(null);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return 'Pending';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-8 text-ink font-sans">
      {/* Container Card for Table */}
      <div className="bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm overflow-hidden p-6 sm:p-8 space-y-6">
        {/* Top Header matching reference */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-paper-border pb-5">
          <div className="flex items-baseline gap-3">
            <h2 className="font-serif text-2xl font-bold tracking-tight text-ink">
              Submissions Log
            </h2>
            <span className="text-xs font-mono text-ink-muted">
              {submissions.length} total entries
            </span>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="w-48 sm:w-64">
              <Input
                placeholder="Search entries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search size={14} />}
                className="bg-paper-high/50"
              />
            </div>

            {/* Filter Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setStatusFilter((prev) =>
                  prev === 'all' ? 'submitted' : prev === 'submitted' ? 'in_progress' : 'all'
                )
              }
              className="h-9 px-2.5 text-ink-muted hover:text-ink border-paper-border"
              title={`Filter: ${statusFilter}`}
            >
              <Filter size={14} />
            </Button>

            {/* Export Dropdown */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="h-9 gap-1.5 border-paper-border text-ink hover:border-terracotta"
              >
                <span>Export</span>
                <ChevronDown size={13} />
              </Button>

              {showExportMenu && (
                <div className="absolute right-0 mt-1.5 w-44 bg-paper-lowest border border-paper-border rounded-md shadow-warm-md z-30 py-1 font-sans text-xs">
                  <button
                    type="button"
                    onClick={() => handleExport('csv')}
                    className="w-full text-left px-3.5 py-2 hover:bg-paper-high flex items-center gap-2 text-ink cursor-pointer"
                  >
                    <FileText size={14} className="text-terracotta" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('xlsx')}
                    className="w-full text-left px-3.5 py-2 hover:bg-paper-high flex items-center gap-2 text-ink cursor-pointer"
                  >
                    <FileSpreadsheet size={14} className="text-forest" />
                    <span>Export Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('pdf')}
                    className="w-full text-left px-3.5 py-2 hover:bg-paper-high flex items-center gap-2 text-ink cursor-pointer"
                  >
                    <FileText size={14} className="text-brick" />
                    <span>Export PDF</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Data Table */}
        {filteredSubmissions.length === 0 ? (
          <div className="py-12 text-center text-xs text-ink-muted italic font-mono">
            No submissions found matching your search.
          </div>
        ) : (
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-[90px_140px_1.2fr_1.8fr_110px] px-4 py-2.5 bg-paper-high/40 font-mono text-[10.5px] font-bold text-ink-muted uppercase border-b border-paper-border select-none">
              <span>ID</span>
              <span>DATE SUBMITTED</span>
              <span>SUBMITTER</span>
              <span>PREVIEW</span>
              <span className="text-right pr-2">STATUS</span>
            </div>

            {/* Rows */}
            {filteredSubmissions.map((sub) => {
              const isExpanded = expandedId === sub.id;
              const submitter = sub.respondent_identifier || `Respondent #${sub.id}`;
              const firstAnswer = sub.answers.find((a) => a.value_text)?.value_text || '—';
              const isSubmitted = !sub.status || sub.status.toLowerCase() === 'submitted';

              return (
                <div key={sub.id} className="border-b border-paper-border/60 last:border-none">
                  {/* Summary Strip */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                    className={`grid grid-cols-[90px_140px_1.2fr_1.8fr_110px] items-center px-4 py-3 text-xs cursor-pointer transition-colors ${
                      isExpanded ? 'bg-paper-high/50 font-medium' : 'hover:bg-paper-high/30'
                    }`}
                  >
                    <span className="font-mono font-bold text-terracotta">#{sub.id}</span>
                    <span className="font-mono text-ink-muted text-[11px]">
                      {formatDate(sub.submitted_at)}
                    </span>
                    <span className="font-medium text-ink truncate pr-2">{submitter}</span>
                    <span className="text-ink-muted truncate pr-4 text-[11px]">{firstAnswer}</span>
                    <div className="text-right">
                      {isSubmitted ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-forest-container text-forest border border-forest-border/40 font-mono text-[10px] font-bold uppercase tracking-wider">
                          SUBMITTED
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-container text-amber border border-amber-border/40 font-mono text-[10px] font-bold uppercase tracking-wider">
                          IN PROGRESS
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded Detail Drawer */}
                  {isExpanded && (
                    <div className="p-6 bg-paper-high/30 border-t border-paper-border space-y-6">
                      <div className="flex items-center justify-between border-b border-paper-border pb-4">
                        <div>
                          <h3 className="font-serif text-xl font-bold text-ink">
                            Full Submission Record
                          </h3>
                          <p className="text-xs font-mono text-ink-muted mt-0.5">
                            ID: #{sub.id} · Submitted {formatDate(sub.submitted_at)}
                          </p>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-semibold text-terracotta">
                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <Printer size={13} />
                            <span>Print Record</span>
                          </button>
                        </div>
                      </div>

                      {/* Answer Pairs Grid */}
                      <div className="bg-paper-lowest border border-paper-border rounded-md p-5 space-y-4 shadow-warm-sm">
                        {sub.answers.length === 0 ? (
                          <p className="text-xs text-ink-muted italic">No answers recorded for this submission.</p>
                        ) : (
                          <div className="space-y-3">
                            {sub.answers.map((ans) => (
                              <div key={ans.id} className="space-y-1">
                                <label className="block text-[10.5px] font-mono font-bold text-ink-muted uppercase">
                                  {ans.field_label}
                                </label>

                                {ans.field_type === 'rating' ? (
                                  <div className="flex items-center gap-1 text-amber">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <Star
                                        key={star}
                                        size={14}
                                        className={
                                          star <= Number(ans.value_text || 0)
                                            ? 'fill-amber-container text-amber'
                                            : 'text-ink-subtle'
                                        }
                                      />
                                    ))}
                                    <span className="text-xs font-mono text-ink-muted ml-1">
                                      ({ans.value_text || 0}/5)
                                    </span>
                                  </div>
                                ) : (
                                  <div className="p-3 bg-paper-high/40 border border-paper-border rounded-sm text-xs font-medium text-ink leading-relaxed whitespace-pre-wrap">
                                    {ans.value_text || <span className="italic text-ink-subtle">No response</span>}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action Footer */}
                      <div className="pt-2 flex items-center justify-between">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExpandedId(null)}
                        >
                          Close Record
                        </Button>

                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setSubToDelete(sub)}
                        >
                          <Trash2 size={14} />
                          <span>Delete Entry</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!subToDelete}
        title="Delete Submission Record"
        message={`Are you sure you want to delete submission #${subToDelete?.id}? This action cannot be undone.`}
        confirmLabel="Delete Record"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setSubToDelete(null)}
      />

      {/* Footer matching reference design */}
      <footer className="pt-10 pb-6 text-center space-y-3 select-none">
        <div className="font-serif text-3xl font-bold text-terracotta tracking-tight">
          IForms
        </div>
        <div className="flex items-center justify-center gap-4 text-xs font-sans text-ink-muted">
          <a href="#terms" className="hover:text-ink transition-colors no-underline">Terms of Service</a>
          <span>·</span>
          <a href="#privacy" className="hover:text-ink transition-colors no-underline">Privacy Policy</a>
          <span>·</span>
          <a href="#support" className="hover:text-ink transition-colors no-underline">Contact Support</a>
        </div>
        <p className="text-[11px] font-mono text-ink-subtle">
          © 2026 IForms. All rights reserved. Built for professional form management.
        </p>
      </footer>
    </div>
  );
};

import React, { useState } from 'react';
import { Form } from '@/types/form';
import { FormSubmission, SubmissionAnswer } from '@/api/forms';
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
    <div className="space-y-6 text-ink font-sans">
      {/* Top Header matching submissions screenshot */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-ink">Submissions</h1>
          <p className="text-sm text-ink-muted mt-1">
            Reviewing {submissions.length} total responses for "{form.title}".
          </p>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter size={14} /> Filter
          </Button>

          {/* Export Dropdown */}
          <div className="relative">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowExportMenu(!showExportMenu)}
            >
              <Download size={14} /> Export CSV
              <ChevronDown size={14} className="ml-1" />
            </Button>

            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-40 bg-paper-lowest border border-paper-border rounded-md shadow-warm-md z-30 py-1 font-sans text-xs">
                <button
                  type="button"
                  onClick={() => handleExport('csv')}
                  className="w-full text-left px-3 py-2 hover:bg-paper-high flex items-center gap-2 text-ink"
                >
                  <FileText size={14} className="text-terracotta" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('xlsx')}
                  className="w-full text-left px-3 py-2 hover:bg-paper-high flex items-center gap-2 text-ink"
                >
                  <FileSpreadsheet size={14} className="text-forest" />
                  <span>Export Excel (XLSX)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('pdf')}
                  className="w-full text-left px-3 py-2 hover:bg-paper-high flex items-center gap-2 text-ink"
                >
                  <FileText size={14} className="text-brick" />
                  <span>Export PDF</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm overflow-hidden space-y-4 p-4">
        {/* Search & Counter Bar matching screenshot */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-paper-border pb-4">
          <div className="w-full sm:w-96">
            <Input
              placeholder="Search by name, email, or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search size={14} />}
            />
          </div>

          <span className="text-xs font-mono text-ink-muted">
            Showing 1-{filteredSubmissions.length} of {submissions.length}
          </span>
        </div>

        {/* Submissions Data Table */}
        {filteredSubmissions.length === 0 ? (
          <div className="py-12 text-center text-xs text-ink-muted italic font-mono">
            No submissions found matching your search.
          </div>
        ) : (
          <div className="space-y-2">
            {/* Table Header */}
            <div className="grid grid-cols-[80px_140px_1fr_1.5fr_100px_40px] px-4 py-2 bg-paper-high/60 font-mono text-[10px] font-bold text-ink-muted uppercase border-b border-paper-border">
              <span>ID</span>
              <span>DATE SUBMITTED</span>
              <span>SUBMITTER</span>
              <span>PREVIEW</span>
              <span>STATUS</span>
              <span>ACTION</span>
            </div>

            {/* Table Rows */}
            {filteredSubmissions.map((sub) => {
              const isExpanded = expandedId === sub.id;
              const submitter = sub.respondent_identifier || `Respondent #${sub.id}`;

              // First non-null text value for preview
              const firstAnswer = sub.answers.find((a) => a.value_text)?.value_text || 'Viewing details...';

              return (
                <div key={sub.id} className="border-b border-paper-border last:border-none">
                  {/* Row Summary Strip */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                    className={`grid grid-cols-[80px_140px_1fr_1.5fr_100px_40px] items-center px-4 py-3 text-xs cursor-pointer transition-colors ${
                      isExpanded ? 'bg-paper-high/40 font-semibold' : 'hover:bg-paper-high/30'
                    }`}
                  >
                    <span className="font-mono font-bold text-terracotta">#{sub.id}</span>
                    <span className="font-mono text-ink-muted">{formatDate(sub.submitted_at)}</span>
                    <span className="font-medium text-ink truncate">{submitter}</span>
                    <span className="text-ink-subtle truncate pr-4">{firstAnswer}</span>
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-forest-fixed text-forest-hover font-mono text-[10px] font-bold uppercase">
                        {sub.status || 'SUBMITTED'}
                      </span>
                    </div>
                    <button type="button" className="text-ink-muted hover:text-ink">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  {/* Expanded Detail Drawer / Row Card matching submission_details_updated screenshot */}
                  {isExpanded && (
                    <div className="p-6 bg-paper-high/30 border-t border-paper-border space-y-6">
                      {/* Record Header & Action Links */}
                      <div className="flex items-center justify-between border-b border-paper-border pb-4">
                        <div>
                          <h3 className="font-serif text-2xl font-bold text-ink">
                            Full Submission Record
                          </h3>
                          <p className="text-xs font-mono text-ink-muted mt-0.5">
                            ID: #{sub.id} · Submitted {formatDate(sub.submitted_at)}
                          </p>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-semibold text-terracotta">
                          <button
                            type="button"
                            className="flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <ExternalLink size={13} />
                            <span>Open as Page</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <Printer size={13} />
                            <span>Print Record</span>
                          </button>
                          <button
                            type="button"
                            className="flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <Mail size={13} />
                            <span>Email Sender</span>
                          </button>
                        </div>
                      </div>

                      {/* Answer Pairs Grid */}
                      <div className="bg-paper-lowest border border-paper-border rounded-md p-6 space-y-4 shadow-warm-sm">
                        {sub.answers.length === 0 ? (
                          <p className="text-xs text-ink-muted italic">No answers recorded for this submission.</p>
                        ) : (
                          <div className="space-y-4">
                            {sub.answers.map((ans) => (
                              <div key={ans.id} className="space-y-1">
                                <label className="block text-[11px] font-mono font-bold text-ink-muted uppercase">
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

                      {/* Footer Actions matching reference screenshot */}
                      <div className="pt-2 flex items-center justify-between">
                        <Button variant="outline" size="sm">
                          <CheckCircle2 size={14} className="text-forest" />
                          <span>Mark as Resolved</span>
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
    </div>
  );
};

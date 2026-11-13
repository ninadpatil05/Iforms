import React from 'react';
import { AiComputedFacts } from '@/types/aiAnalysis';
import { CornerBrackets } from '@/components/CornerBrackets';
import { Database, Eye, FileCheck, Percent, Clock } from 'lucide-react';

interface OverviewTabProps {
  computedFacts: AiComputedFacts;
}

const formatSeconds = (totalSeconds?: number | null): string => {
  if (totalSeconds === null || totalSeconds === undefined) return 'N/A';
  const secs = Math.round(totalSeconds);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
};

export const OverviewTab: React.FC<OverviewTabProps> = ({ computedFacts: facts }) => {
  return (
    <div className="relative bg-paper-lowest border border-paper-border rounded-md p-6 sm:p-8 space-y-6 shadow-warm-sm">
      <CornerBrackets />

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper-border pb-4">
        <div className="flex items-center gap-2">
          <Database className="text-terracotta" size={18} />
          <h3 className="text-xl font-serif font-bold text-ink">From Your Data</h3>
        </div>
        <span className="px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider bg-paper-high text-terracotta border border-paper-border rounded-full">
          Computed Ground-Truth Stats
        </span>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-paper-base/50 border border-paper-border rounded-md space-y-1">
          <span className="text-xs font-mono text-ink-muted flex items-center gap-1">
            <Eye size={13} /> Views
          </span>
          <p className="text-3xl font-mono font-bold text-ink tracking-tight">{facts.total_views}</p>
          <p className="text-[10.5px] text-ink-muted">Total form opens</p>
        </div>

        <div className="p-4 bg-paper-base/50 border border-paper-border rounded-md space-y-1">
          <span className="text-xs font-mono text-ink-muted flex items-center gap-1">
            <FileCheck size={13} /> Submissions
          </span>
          <p className="text-3xl font-mono font-bold text-ink tracking-tight">{facts.total_submitted}</p>
          <p className="text-[10.5px] text-ink-muted">Total responses received</p>
        </div>

        <div className="p-4 bg-paper-base/50 border border-paper-border rounded-md space-y-1">
          <span className="text-xs font-mono text-ink-muted flex items-center gap-1">
            <Percent size={13} /> Completion Rate
          </span>
          <p className="text-3xl font-mono font-bold text-ink tracking-tight">
            {(facts.completion_rate * 100).toFixed(1)}%
          </p>
          <p className="text-[10.5px] text-ink-muted">% of visitors who completed</p>
        </div>

        <div className="p-4 bg-paper-base/50 border border-paper-border rounded-md space-y-1">
          <span className="text-xs font-mono text-ink-muted flex items-center gap-1">
            <Clock size={13} /> Avg Time
          </span>
          <p className="text-3xl font-mono font-bold text-ink tracking-tight">
            {formatSeconds(facts.average_completion_seconds)}
          </p>
          <p className="text-[10.5px] text-ink-muted">Average completion time</p>
        </div>
      </div>

      {/* Per-field response counts */}
      {facts.per_field_response_counts && facts.per_field_response_counts.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-paper-border">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-ink-muted">
            Response Count Per Field
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {facts.per_field_response_counts.map((item) => (
              <div
                key={item.field_id}
                className="px-3.5 py-2.5 bg-paper-base/40 border border-paper-border rounded-sm flex items-center justify-between text-xs"
              >
                <span className="truncate text-ink font-medium">{item.field_label}</span>
                <span className="font-mono font-bold text-terracotta shrink-0 ml-2">
                  {item.response_count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

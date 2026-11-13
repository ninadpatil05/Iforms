import React from 'react';
import { AiAnalysisReport } from '@/types/aiAnalysis';
import {
  Sparkles,
  Database,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  CheckCircle2,
  HelpCircle,
  Clock,
  Eye,
  FileCheck,
  Percent,
} from 'lucide-react';

interface AnalysisReportViewProps {
  report: AiAnalysisReport;
}

const formatSeconds = (totalSeconds?: number | null): string => {
  if (totalSeconds === null || totalSeconds === undefined) return 'N/A';
  const secs = Math.round(totalSeconds);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
};

const getConfidenceBadgeColor = (confidence: 'high' | 'medium' | 'low') => {
  switch (confidence) {
    case 'high':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
    case 'medium':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
    case 'low':
      return 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20';
  }
};

const getSentimentBadgeColor = (sentiment: 'positive' | 'neutral' | 'negative' | 'mixed') => {
  switch (sentiment) {
    case 'positive':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
    case 'neutral':
      return 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20';
    case 'negative':
      return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20';
    case 'mixed':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
  }
};

export const AnalysisReportView: React.FC<AnalysisReportViewProps> = ({ report }) => {
  const { computed_facts: facts, generated } = report;
  const hasLimitations = generated.limitations && generated.limitations.length > 0;

  return (
    <div className="space-y-8">
      {/* 1. Limitations Callout (Prominent near top) */}
      {hasLimitations && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
          <AlertTriangle className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={20} />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Analysis Limitations & Considerations
            </h4>
            <ul className="list-disc list-inside text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
              {generated.limitations.map((lim, idx) => (
                <li key={idx}>{lim}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 2. Executive Summary */}
      <div className="p-6 bg-paper-surface border border-paper-border rounded-xl shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="text-accent" size={18} />
          <h3 className="text-lg font-serif font-bold text-ink">Executive Summary</h3>
        </div>
        <p className="text-sm text-ink-muted leading-relaxed">{generated.executive_summary}</p>
      </div>

      {/* 3. COMPUTED FACTS (Ground-truth data section) */}
      <div className="p-6 bg-paper-base/70 border-2 border-paper-border rounded-xl shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper-border pb-4">
          <div className="flex items-center gap-2">
            <Database className="text-cyan-700 dark:text-cyan-400" size={18} />
            <h3 className="text-lg font-serif font-bold text-ink">From Your Data</h3>
          </div>
          <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border border-cyan-500/20 rounded-full">
            Computed Ground-Truth Stats
          </span>
        </div>

        {/* Stat Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-paper-surface border border-paper-border rounded-lg space-y-1">
            <span className="text-xs text-ink-muted flex items-center gap-1">
              <Eye size={13} /> Views
            </span>
            <p className="text-2xl font-serif font-bold text-ink">{facts.total_views}</p>
            <p className="text-[10.5px] text-ink-muted">Total people who opened form</p>
          </div>

          <div className="p-4 bg-paper-surface border border-paper-border rounded-lg space-y-1">
            <span className="text-xs text-ink-muted flex items-center gap-1">
              <FileCheck size={13} /> Submissions
            </span>
            <p className="text-2xl font-serif font-bold text-ink">{facts.total_submitted}</p>
            <p className="text-[10.5px] text-ink-muted">Total submitted responses</p>
          </div>

          <div className="p-4 bg-paper-surface border border-paper-border rounded-lg space-y-1">
            <span className="text-xs text-ink-muted flex items-center gap-1">
              <Percent size={13} /> Completion Rate
            </span>
            <p className="text-2xl font-serif font-bold text-ink">
              {(facts.completion_rate * 100).toFixed(1)}%
            </p>
            <p className="text-[10.5px] text-ink-muted">% of visitors who finished</p>
          </div>

          <div className="p-4 bg-paper-surface border border-paper-border rounded-lg space-y-1">
            <span className="text-xs text-ink-muted flex items-center gap-1">
              <Clock size={13} /> Avg Time
            </span>
            <p className="text-2xl font-serif font-bold text-ink">
              {formatSeconds(facts.average_completion_seconds)}
            </p>
            <p className="text-[10.5px] text-ink-muted">Average time spent filling</p>
          </div>
        </div>

        {/* Per-field response counts */}
        {facts.per_field_response_counts && facts.per_field_response_counts.length > 0 && (
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Response Count Per Field
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {facts.per_field_response_counts.map((item) => (
                <div
                  key={item.field_id}
                  className="px-3 py-2 bg-paper-surface border border-paper-border rounded-md flex items-center justify-between text-xs"
                >
                  <span className="truncate text-ink font-medium">{item.field_label}</span>
                  <span className="font-semibold text-accent shrink-0 ml-2">
                    {item.response_count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. AI INSIGHTS */}
      {generated.insights && generated.insights.length > 0 && (
        <div className="p-6 bg-paper-surface border border-paper-border rounded-xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-paper-border pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-accent" size={18} />
              <h3 className="text-lg font-serif font-bold text-ink">AI Key Insights</h3>
            </div>
            <span className="px-2.5 py-0.5 text-xs font-medium bg-accent/10 text-accent border border-accent/20 rounded-full">
              AI Interpretation
            </span>
          </div>

          <div className="space-y-4">
            {generated.insights.map((insight, idx) => (
              <div
                key={idx}
                className="p-4 bg-paper-base/40 border border-paper-border rounded-lg space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-paper-surface border border-paper-border rounded text-ink-muted">
                    {insight.type}
                  </span>

                  <span
                    className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded border ${getConfidenceBadgeColor(
                      insight.confidence
                    )}`}
                  >
                    {insight.confidence} confidence
                  </span>
                </div>

                <p className="text-sm font-medium text-ink">{insight.text}</p>

                {insight.evidence && (
                  <p className="text-xs text-ink-muted bg-paper-surface p-2 rounded border border-paper-border/60">
                    <strong>Evidence:</strong> {insight.evidence.response_count} responses
                    {insight.evidence.supporting_value && ` (e.g. "${insight.evidence.supporting_value}")`}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. OPEN-TEXT THEMES */}
      {generated.open_text_themes && generated.open_text_themes.length > 0 && (
        <div className="p-6 bg-paper-surface border border-paper-border rounded-xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-paper-border pb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="text-accent" size={18} />
              <h3 className="text-lg font-serif font-bold text-ink">Open-Text Themes</h3>
            </div>
            <span className="px-2.5 py-0.5 text-xs font-medium bg-accent/10 text-accent border border-accent/20 rounded-full">
              AI Interpretation
            </span>
          </div>

          <div className="space-y-6">
            {generated.open_text_themes.map((fieldTheme) => (
              <div key={fieldTheme.field_id} className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <h4 className="font-semibold text-ink">{fieldTheme.field_label}</h4>
                  <span className="text-ink-muted">Sample size: {fieldTheme.sample_size}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {fieldTheme.themes.map((themeItem, tIdx) => (
                    <div
                      key={tIdx}
                      className="p-3 bg-paper-base/40 border border-paper-border rounded-lg flex items-start justify-between gap-2"
                    >
                      <div>
                        <p className="text-xs font-medium text-ink">{themeItem.theme}</p>
                        <span className="text-[11px] text-ink-muted">
                          ~{(themeItem.approx_share * 100).toFixed(0)}% of responses
                        </span>
                      </div>

                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold capitalize rounded border shrink-0 ${getSentimentBadgeColor(
                          themeItem.sentiment
                        )}`}
                      >
                        {themeItem.sentiment}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. ANOMALIES */}
      {generated.anomalies && generated.anomalies.length > 0 && (
        <div className="p-6 bg-paper-surface border border-paper-border rounded-xl shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 border-b border-paper-border pb-3">
            <AlertTriangle size={18} />
            <h3 className="text-lg font-serif font-bold text-ink">Detected Anomalies</h3>
          </div>

          <div className="space-y-3">
            {generated.anomalies.map((anomaly, idx) => (
              <div key={idx} className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-lg space-y-1">
                <p className="text-sm font-medium text-ink">{anomaly.description}</p>
                <p className="text-xs text-ink-muted">
                  <strong>Evidence:</strong> {anomaly.evidence}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. SUGGESTED ACTIONS */}
      {generated.suggested_actions && generated.suggested_actions.length > 0 && (
        <div className="p-6 bg-paper-surface border border-paper-border rounded-xl shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-paper-border pb-3">
            <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={18} />
            <h3 className="text-lg font-serif font-bold text-ink">Suggested Actions</h3>
          </div>

          <ul className="space-y-2 text-sm text-ink-muted">
            {generated.suggested_actions.map((action, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="font-bold text-accent">{idx + 1}.</span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 8. FORM IMPROVEMENT SUGGESTIONS */}
      {generated.form_improvement_suggestions && generated.form_improvement_suggestions.length > 0 && (
        <div className="p-6 bg-paper-surface border border-paper-border rounded-xl shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-paper-border pb-3">
            <HelpCircle className="text-accent" size={18} />
            <h3 className="text-lg font-serif font-bold text-ink">Form Improvement Suggestions</h3>
          </div>

          <div className="space-y-2">
            {generated.form_improvement_suggestions.map((imp, idx) => (
              <div key={idx} className="p-3 bg-paper-base/40 border border-paper-border rounded-lg text-xs">
                <p className="text-ink font-medium">{imp.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

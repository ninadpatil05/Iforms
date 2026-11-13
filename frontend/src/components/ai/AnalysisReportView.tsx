import React from 'react';
import { AiAnalysisReport } from '@/types/aiAnalysis';
import { CornerBrackets } from '@/components/CornerBrackets';
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
  showComputedFacts?: boolean;
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
      return 'bg-forest-container text-forest border-forest-border/40';
    case 'medium':
      return 'bg-amber-container text-amber border-amber-border/40';
    case 'low':
      return 'bg-paper-high text-ink-muted border-paper-border';
  }
};

const getSentimentBadgeColor = (sentiment: 'positive' | 'neutral' | 'negative' | 'mixed') => {
  switch (sentiment) {
    case 'positive':
      return 'bg-forest-container text-forest border-forest-border/40';
    case 'neutral':
      return 'bg-paper-high text-ink-muted border-paper-border';
    case 'negative':
      return 'bg-brick-container text-brick border-brick-border/40';
    case 'mixed':
      return 'bg-amber-container text-amber border-amber-border/40';
  }
};

export const AnalysisReportView: React.FC<AnalysisReportViewProps> = ({
  report,
  showComputedFacts = false,
}) => {
  const { computed_facts: facts, generated } = report;
  const hasLimitations = generated.limitations && generated.limitations.length > 0;

  return (
    <div className="space-y-6">
      {/* 1. Limitations Callout */}
      {hasLimitations && (
        <div className="p-4 bg-amber-container/60 border border-amber-border/40 rounded-md flex items-start gap-3">
          <AlertTriangle className="text-amber shrink-0 mt-0.5" size={18} />
          <div className="space-y-1">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-amber">
              Analysis Limitations & Considerations
            </h4>
            <ul className="list-disc list-inside text-xs text-ink space-y-0.5 font-sans">
              {generated.limitations.map((lim, idx) => (
                <li key={idx}>{lim}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 2. Executive Summary */}
      <div className="relative bg-paper-lowest border border-paper-border rounded-md p-6 space-y-2 shadow-warm-sm">
        <CornerBrackets />
        <div className="flex items-center gap-2 border-b border-paper-border pb-2">
          <Sparkles className="text-terracotta" size={16} />
          <h3 className="text-lg font-serif font-bold text-ink">Executive Summary</h3>
        </div>
        <p className="text-xs leading-relaxed text-ink font-sans pt-1">
          {generated.executive_summary}
        </p>
      </div>

      {/* 3. COMPUTED FACTS (Only when showComputedFacts is true) */}
      {showComputedFacts && (
        <div className="relative bg-paper-lowest border border-paper-border rounded-md p-6 space-y-5 shadow-warm-sm">
          <CornerBrackets />
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper-border pb-3">
            <div className="flex items-center gap-2">
              <Database className="text-terracotta" size={16} />
              <h3 className="text-lg font-serif font-bold text-ink">From Your Data</h3>
            </div>
            <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-paper-high text-terracotta border border-paper-border rounded-full">
              Computed Ground-Truth Stats
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3.5 bg-paper-base/50 border border-paper-border rounded-sm space-y-1">
              <span className="text-xs font-mono text-ink-muted flex items-center gap-1">
                <Eye size={13} /> Views
              </span>
              <p className="text-2xl font-mono font-bold text-ink">{facts.total_views}</p>
            </div>

            <div className="p-3.5 bg-paper-base/50 border border-paper-border rounded-sm space-y-1">
              <span className="text-xs font-mono text-ink-muted flex items-center gap-1">
                <FileCheck size={13} /> Submissions
              </span>
              <p className="text-2xl font-mono font-bold text-ink">{facts.total_submitted}</p>
            </div>

            <div className="p-3.5 bg-paper-base/50 border border-paper-border rounded-sm space-y-1">
              <span className="text-xs font-mono text-ink-muted flex items-center gap-1">
                <Percent size={13} /> Completion Rate
              </span>
              <p className="text-2xl font-mono font-bold text-ink">
                {(facts.completion_rate * 100).toFixed(1)}%
              </p>
            </div>

            <div className="p-3.5 bg-paper-base/50 border border-paper-border rounded-sm space-y-1">
              <span className="text-xs font-mono text-ink-muted flex items-center gap-1">
                <Clock size={13} /> Avg Time
              </span>
              <p className="text-2xl font-mono font-bold text-ink">
                {formatSeconds(facts.average_completion_seconds)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. AI INSIGHTS */}
      {generated.insights && generated.insights.length > 0 && (
        <div className="relative bg-paper-lowest border border-paper-border rounded-md p-6 space-y-4 shadow-warm-sm">
          <CornerBrackets />
          <div className="flex items-center justify-between border-b border-paper-border pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-terracotta" size={16} />
              <h3 className="text-lg font-serif font-bold text-ink">AI Key Insights</h3>
            </div>
            <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-terracotta-fixed text-terracotta border border-terracotta-container rounded-full">
              AI Interpretation
            </span>
          </div>

          <div className="space-y-3">
            {generated.insights.map((insight, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-paper-base/40 border border-paper-border rounded-sm space-y-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-paper-high border border-paper-border rounded-sm text-ink-muted">
                    {insight.type}
                  </span>

                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-full border ${getConfidenceBadgeColor(
                      insight.confidence
                    )}`}
                  >
                    {insight.confidence} confidence
                  </span>
                </div>

                <p className="font-medium text-ink leading-relaxed">{insight.text}</p>

                {insight.evidence && (
                  <p className="text-[11px] font-mono text-ink-muted bg-paper-high/60 p-2 rounded-sm border border-paper-border">
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
        <div className="relative bg-paper-lowest border border-paper-border rounded-md p-6 space-y-4 shadow-warm-sm">
          <CornerBrackets />
          <div className="flex items-center justify-between border-b border-paper-border pb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="text-terracotta" size={16} />
              <h3 className="text-lg font-serif font-bold text-ink">Open-Text Themes</h3>
            </div>
            <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-terracotta-fixed text-terracotta border border-terracotta-container rounded-full">
              AI Interpretation
            </span>
          </div>

          <div className="space-y-5">
            {generated.open_text_themes.map((fieldTheme) => (
              <div key={fieldTheme.field_id} className="space-y-2.5">
                <div className="flex items-center justify-between text-xs border-b border-paper-border/60 pb-1">
                  <h4 className="font-semibold text-ink font-sans">{fieldTheme.field_label}</h4>
                  <span className="font-mono text-ink-muted text-[11px]">
                    Sample size: {fieldTheme.sample_size}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {fieldTheme.themes.map((themeItem, tIdx) => (
                    <div
                      key={tIdx}
                      className="p-3 bg-paper-base/40 border border-paper-border rounded-sm flex items-start justify-between gap-2 text-xs"
                    >
                      <div>
                        <p className="font-medium text-ink">{themeItem.theme}</p>
                        <span className="text-[11px] font-mono text-ink-muted">
                          ~{(themeItem.approx_share * 100).toFixed(0)}% of responses
                        </span>
                      </div>

                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-full border shrink-0 ${getSentimentBadgeColor(
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
        <div className="relative bg-paper-lowest border border-paper-border rounded-md p-6 space-y-4 shadow-warm-sm">
          <CornerBrackets />
          <div className="flex items-center gap-2 border-b border-paper-border pb-3 text-brick">
            <AlertTriangle size={16} />
            <h3 className="text-lg font-serif font-bold text-ink">Detected Anomalies</h3>
          </div>

          <div className="space-y-3">
            {generated.anomalies.map((anomaly, idx) => (
              <div key={idx} className="p-3.5 bg-brick-container/40 border border-brick-border/40 rounded-sm space-y-1 text-xs">
                <p className="font-medium text-ink">{anomaly.description}</p>
                <p className="text-[11px] font-mono text-ink-muted">
                  <strong>Evidence:</strong> {anomaly.evidence}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. SUGGESTED ACTIONS */}
      {generated.suggested_actions && generated.suggested_actions.length > 0 && (
        <div className="relative bg-paper-lowest border border-paper-border rounded-md p-6 space-y-4 shadow-warm-sm">
          <CornerBrackets />
          <div className="flex items-center gap-2 border-b border-paper-border pb-3">
            <CheckCircle2 className="text-forest" size={16} />
            <h3 className="text-lg font-serif font-bold text-ink">Suggested Actions</h3>
          </div>

          <ul className="space-y-2 text-xs text-ink font-sans">
            {generated.suggested_actions.map((action, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="font-mono font-bold text-terracotta">{idx + 1}.</span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 8. FORM IMPROVEMENT SUGGESTIONS */}
      {generated.form_improvement_suggestions && generated.form_improvement_suggestions.length > 0 && (
        <div className="relative bg-paper-lowest border border-paper-border rounded-md p-6 space-y-4 shadow-warm-sm">
          <CornerBrackets />
          <div className="flex items-center gap-2 border-b border-paper-border pb-3">
            <HelpCircle className="text-terracotta" size={16} />
            <h3 className="text-lg font-serif font-bold text-ink">Form Improvement Suggestions</h3>
          </div>

          <div className="space-y-2">
            {generated.form_improvement_suggestions.map((imp, idx) => (
              <div key={idx} className="p-3 bg-paper-base/40 border border-paper-border rounded-sm text-xs">
                <p className="text-ink font-medium">{imp.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

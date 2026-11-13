import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/Button';
import { AnalysisReportView } from '@/components/ai/AnalysisReportView';
import { getFormById, getPublishedFormLink } from '@/api/forms';
import { getCurrentVersion } from '@/api/fields';
import { getDashboard } from '@/api/analytics';
import { getLatestReport, runAnalysis, seedDemoSubmissions } from '@/api/aiAnalysis';
import { Form } from '@/types/form';
import { AiAnalysisReport } from '@/types/aiAnalysis';
import {
  Sparkles,
  RefreshCw,
  ArrowLeft,
  Loader2,
  AlertCircle,
  BarChart2,
  Printer,
  PlusCircle,
  Play,
} from 'lucide-react';

export const AIFormAnalyzer: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const id = Number(formId);

  const [form, setForm] = useState<Form | null>(null);
  const [formVersionId, setFormVersionId] = useState<number | null>(null);
  const [report, setReport] = useState<AiAnalysisReport | null>(null);
  const [currentSubmissionCount, setCurrentSubmissionCount] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

    try {
      const loadedForm = await getFormById(id);
      setForm(loadedForm);

      let versionId: number;
      try {
        const pubLink = await getPublishedFormLink(id);
        versionId = pubLink.form_version_id;
      } catch {
        const draft = await getCurrentVersion(id);
        versionId = draft.id;
      }

      setFormVersionId(versionId);

      const [latestReport, dash] = await Promise.all([
        getLatestReport(versionId).catch(() => null),
        getDashboard(versionId).catch(() => null),
      ]);

      setReport(latestReport);
      if (dash?.overview) {
        setCurrentSubmissionCount(dash.overview.total_submitted);
      }
    } catch {
      setError('Could not load form or analysis data. Please check connection.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRunAnalysis = async () => {
    if (!formVersionId) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      const newReport = await runAnalysis(formVersionId);
      setReport(newReport);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 503) {
        setError('AI is temporarily unavailable, please try again.');
      } else if (status === 502) {
        setError("Couldn't understand the AI's response, please try again.");
      } else if (status === 429) {
        setError('Rate limit exceeded. Maximum 5 analyses per hour allowed.');
      } else {
        setError('Failed to run AI analysis. Please try again.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSeedDemoSubmissions = async () => {
    if (!formVersionId) return;
    setIsSeeding(true);
    setError(null);
    try {
      await seedDemoSubmissions(formVersionId);
      await loadData();
      await handleRunAnalysis();
    } catch {
      setError('Failed to generate sample submissions.');
    } finally {
      setIsSeeding(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const newResponsesCount =
    report && currentSubmissionCount !== null
      ? Math.max(0, currentSubmissionCount - report.submission_count_at_run)
      : 0;

  return (
    <div className="min-h-screen bg-paper-base text-ink flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Navigation & Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Link
              to={`/forms/${id}`}
              className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors"
            >
              <ArrowLeft size={16} /> Back to Form Details
            </Link>
            <span className="text-ink-muted/40">•</span>
            <Link
              to={`/forms/${id}/analytics`}
              className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors"
            >
              <BarChart2 size={16} /> Analytics Dashboard
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-paper-border pb-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                AI Form Intelligence
              </span>
              <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-ink mt-0.5">
                {form ? form.title : 'Form AI Analysis'}
              </h1>
              <p className="text-sm text-ink-muted mt-1 leading-relaxed">
                Automated sentiment extraction, open-text theme clustering, and metric insights.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePrint}
                leftIcon={<Printer size={15} />}
              >
                Print / Save PDF
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleSeedDemoSubmissions}
                isLoading={isSeeding}
                leftIcon={<PlusCircle size={15} />}
              >
                Auto-Generate 5 Sample Submissions
              </Button>

              {report && !isAnalyzing && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRunAnalysis}
                  leftIcon={<RefreshCw size={15} />}
                >
                  Re-analyze Responses
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Error Notification Banner */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-xl flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="text-sm leading-relaxed">{error}</div>
          </div>
        )}

        {/* Loading Initial State */}
        {isLoading && (
          <div className="p-12 text-center bg-paper-surface border border-paper-border rounded-xl space-y-3">
            <Loader2 size={24} className="animate-spin text-accent mx-auto" />
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Loading Analysis History…
            </p>
          </div>
        )}

        {/* Analyzing Active State */}
        {isAnalyzing && (
          <div className="p-12 text-center bg-paper-surface border border-paper-border rounded-xl space-y-4">
            <div className="inline-flex items-center justify-center p-4 bg-accent/10 text-accent rounded-full animate-bounce">
              <Sparkles size={32} />
            </div>
            <div>
              <h3 className="text-lg font-serif font-semibold text-ink">Analyzing responses…</h3>
              <p className="text-sm text-ink-muted mt-1">
                Synthesizing metrics, clustering open-text sentiment, and detecting anomalies.
              </p>
            </div>
          </div>
        )}

        {/* No Analysis Report Yet — Empty State */}
        {!isLoading && !isAnalyzing && !report && (
          <div className="p-12 text-center bg-paper-surface border border-paper-border rounded-xl space-y-4">
            <div className="inline-flex items-center justify-center p-4 bg-paper-base border border-paper-border text-accent rounded-full">
              <Sparkles size={32} />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-xl font-serif font-bold text-ink">No AI Analysis Generated Yet</h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                Run an AI analysis to extract open-text sentiment themes, key trends, and form improvement suggestions.
              </p>
            </div>

            <Button
              variant="primary"
              size="lg"
              onClick={handleRunAnalysis}
              leftIcon={<Play size={18} />}
            >
              Run AI Analysis
            </Button>
          </div>
        )}

        {/* Existing Analysis Report Display */}
        {!isLoading && !isAnalyzing && report && (
          <div className="space-y-6">
            {/* New responses notification note */}
            {newResponsesCount > 0 && (
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-800 dark:text-cyan-300 rounded-lg flex items-center justify-between text-xs">
                <span>
                  <strong>{newResponsesCount} new responses</strong> received since this analysis was generated.
                </span>
                <button
                  type="button"
                  onClick={handleRunAnalysis}
                  className="font-semibold text-cyan-700 dark:text-cyan-200 hover:underline"
                >
                  Update Analysis
                </button>
              </div>
            )}

            {/* Main Report View Component */}
            <AnalysisReportView report={report} />
          </div>
        )}
      </main>
    </div>
  );
};

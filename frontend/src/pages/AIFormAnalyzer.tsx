import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/Button';
import { AnalysisReportView } from '@/components/ai/AnalysisReportView';
import { FormSidebar } from '@/components/FormSidebar';
import { OverviewTab } from '@/components/ai/OverviewTab';
import { ExplorerTab } from '@/components/ai/ExplorerTab';
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
  Compass,
} from 'lucide-react';

export const AIFormAnalyzer: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const id = Number(formId);

  const [form, setForm] = useState<Form | null>(null);
  const [formVersionId, setFormVersionId] = useState<number | null>(null);
  const [report, setReport] = useState<AiAnalysisReport | null>(null);
  const [currentSubmissionCount, setCurrentSubmissionCount] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'insights' | 'explorer'>('overview');
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

      <div className="flex-1 flex max-w-7xl w-full mx-auto overflow-hidden">
        <FormSidebar
          formId={id}
          title={form?.title || 'Form AI Analysis'}
          status={form?.status || 'published'}
          responseCount={currentSubmissionCount || 0}
          activePage="ai-analysis"
        />
        <main className="flex-1 px-4 sm:px-8 py-8 space-y-6 overflow-y-auto">
        {/* Navigation & Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 font-mono text-xs">
            <Link
              to={`/forms/${id}`}
              className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink transition-colors"
            >
              <ArrowLeft size={14} /> Back to Form Details
            </Link>
            <span className="text-ink-subtle">•</span>
            <Link
              to={`/forms/${id}/analytics`}
              className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink transition-colors"
            >
              <BarChart2 size={14} /> Analytics Dashboard
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-paper-border pb-6">
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-terracotta">
                AI Form Intelligence
              </span>
              <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-ink mt-0.5">
                {form ? form.title : 'Form AI Analysis'}
              </h1>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                Automated sentiment extraction, open-text theme clustering, and submission categorization.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                leftIcon={<Printer size={14} />}
                className="h-8 text-xs border-paper-border text-ink"
              >
                Print PDF
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSeedDemoSubmissions}
                isLoading={isSeeding}
                leftIcon={<PlusCircle size={14} />}
                className="h-8 text-xs border-paper-border text-ink"
              >
                Auto-Generate 5 Samples
              </Button>

              {report && !isAnalyzing && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRunAnalysis}
                  leftIcon={<RefreshCw size={14} />}
                  className="h-8 text-xs bg-terracotta hover:bg-terracotta-hover text-white font-medium"
                >
                  Re-analyze Responses
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Error Notification Banner */}
        {error && (
          <div className="p-3.5 bg-brick-container/70 border border-brick-border text-brick font-mono text-xs flex items-center gap-2 rounded-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* 3-TAB NAVIGATION BAR */}
        <div className="flex items-center gap-2 border-b border-paper-border select-none">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-terracotta text-terracotta bg-paper-lowest rounded-t-md shadow-warm-sm'
                : 'border-transparent text-ink-muted hover:text-ink hover:bg-paper-high/50'
            }`}
          >
            <BarChart2 size={14} /> Overview
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('insights')}
            className={`px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'insights'
                ? 'border-terracotta text-terracotta bg-paper-lowest rounded-t-md shadow-warm-sm'
                : 'border-transparent text-ink-muted hover:text-ink hover:bg-paper-high/50'
            }`}
          >
            <Sparkles size={14} /> Insights
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('explorer')}
            className={`px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'explorer'
                ? 'border-terracotta text-terracotta bg-paper-lowest rounded-t-md shadow-warm-sm'
                : 'border-transparent text-ink-muted hover:text-ink hover:bg-paper-high/50'
            }`}
          >
            <Compass size={14} /> Explorer
          </button>
        </div>

        {/* TAB CONTENTS */}

        {/* Loading State */}
        {isLoading && (
          <div className="p-12 text-center bg-paper-lowest border border-paper-border rounded-md space-y-3">
            <Loader2 size={24} className="animate-spin text-terracotta mx-auto" />
            <p className="text-xs font-mono uppercase text-ink-muted">Loading Workspace Data…</p>
          </div>
        )}

        {/* Analyzing Active State */}
        {!isLoading && isAnalyzing && (
          <div className="p-12 text-center bg-paper-lowest border border-paper-border rounded-md space-y-4">
            <div className="inline-flex items-center justify-center p-4 bg-terracotta-fixed text-terracotta rounded-full animate-bounce">
              <Sparkles size={32} />
            </div>
            <div>
              <h3 className="text-xl font-serif font-bold text-ink">Analyzing responses…</h3>
              <p className="text-xs font-mono text-ink-muted mt-1">
                Synthesizing metrics, clustering open-text sentiment, and categorizing responses.
              </p>
            </div>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {!isLoading && !isAnalyzing && activeTab === 'overview' && (
          <div>
            {report ? (
              <OverviewTab computedFacts={report.computed_facts} />
            ) : (
              <div className="p-12 text-center bg-paper-lowest border border-paper-border rounded-md space-y-3">
                <p className="text-xs font-mono text-ink-muted">No ground-truth facts available yet.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: INSIGHTS */}
        {!isLoading && !isAnalyzing && activeTab === 'insights' && (
          <div className="space-y-6">
            {!report ? (
              <div className="p-12 text-center bg-paper-lowest border border-paper-border rounded-md space-y-4">
                <div className="inline-flex items-center justify-center p-4 bg-paper-high text-terracotta rounded-full">
                  <Sparkles size={32} />
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="text-xl font-serif font-bold text-ink">No AI Analysis Generated Yet</h3>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Run an AI analysis to extract open-text themes, key insights, and form improvement recommendations.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleRunAnalysis}
                  leftIcon={<Play size={16} />}
                  className="bg-terracotta hover:bg-terracotta-hover text-white font-medium"
                >
                  Run AI Analysis
                </Button>
              </div>
            ) : (
              <div>
                {newResponsesCount > 0 && (
                  <div className="p-3 mb-4 bg-amber-container/60 border border-amber-border/40 text-amber rounded-sm flex items-center justify-between text-xs font-mono">
                    <span>
                      <strong>{newResponsesCount} new responses</strong> received since this analysis run.
                    </span>
                    <button
                      type="button"
                      onClick={handleRunAnalysis}
                      className="font-bold underline hover:text-ink cursor-pointer"
                    >
                      Update Analysis
                    </button>
                  </div>
                )}

                <AnalysisReportView report={report} showComputedFacts={false} />
              </div>
            )}
          </div>
        )}

        {/* TAB 3: EXPLORER */}
        {!isLoading && !isAnalyzing && activeTab === 'explorer' && (
          <ExplorerTab formId={id} formVersionId={formVersionId || id} />
        )}
      </main>
      </div>
    </div>
  );
};

export default AIFormAnalyzer;

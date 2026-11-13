import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getFormDashboard, getDashboard } from '@/api/analytics';
import { getFormById, getPublishedFormLink, getFormSubmissions, FormSubmission } from '@/api/forms';
import { getCurrentVersion } from '@/api/fields';
import { exportSubmissions, ExportFormat } from '@/api/export';
import { Form } from '@/types/form';
import { AnalyticsDashboardResponse } from '@/types/analytics';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/Button';
import { FormSidebar } from '@/components/FormSidebar';
import {
  Eye,
  CheckSquare,
  TrendingUp,
  TrendingDown,
  Clock,
  Download,
  Calendar,
  FileText,
  FileSpreadsheet,
  BarChart2,
  Settings,
  Bell,
  HelpCircle,
  Pencil,
  ChevronDown,
  MoreHorizontal,
  Sparkles,
  Loader2,
  AlertCircle,
  RefreshCw,
  Users,
  Link as LinkIcon,
  Mail,
  PieChart,
} from 'lucide-react';

const formatSeconds = (totalSeconds: number | null | undefined): string => {
  if (totalSeconds === null || totalSeconds === undefined || isNaN(totalSeconds)) return '—';
  const secs = Math.round(totalSeconds);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
};

const formatDate = (isoStr: string | null) => {
  if (!isoStr) return 'Just now';
  const date = new Date(isoStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

type TimeRangeOption = '7' | '30' | '90' | 'all';

export const Analytics: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const id = Number(formId);
  const toast = useToast();
  const { user } = useAuth();

  const [form, setForm] = useState<Form | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsDashboardResponse | null>(null);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState<'overview' | 'demographics' | 'sources'>('overview');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showTimeRangeMenu, setShowTimeRangeMenu] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('30');

  const loadData = useCallback(async () => {
    if (!id || isNaN(id)) {
      setError('Invalid Form ID.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const loadedForm = await getFormById(id);
      setForm(loadedForm);

      let dashData: AnalyticsDashboardResponse | null = null;

      try {
        dashData = await getFormDashboard(id);
      } catch {
        // Fallback to version-specific dashboard if getFormDashboard endpoint is unavailable
        try {
          let versionId: number;
          try {
            const pubLink = await getPublishedFormLink(id);
            versionId = pubLink.form_version_id;
          } catch {
            const draft = await getCurrentVersion(id);
            versionId = draft.id;
          }
          dashData = await getDashboard(versionId);
        } catch {
          dashData = null;
        }
      }

      const subsData = await getFormSubmissions(id).catch(() => []);

      setAnalytics(dashData);
      setSubmissions(subsData);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 403) {
        setError('Access denied. You do not have permission to view analytics for this form.');
      } else if (status === 404) {
        setError('Form not found.');
      } else {
        setError('Could not load analytics data. Please check your connection and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = async (format: ExportFormat) => {
    if (!id) return;
    setShowExportMenu(false);
    try {
      await exportSubmissions(id, format);
      toast.success('Export started', `Downloading analytics as ${format.toUpperCase()}.`);
    } catch {
      toast.error('Export failed', `Could not export analytics as ${format.toUpperCase()}.`);
    }
  };

  // Derive dynamic metrics per individual form
  const overview = analytics?.overview;
  const totalViews = overview?.total_views ?? 0;
  const totalSubmissions = overview?.total_submitted ?? submissions.length;
  const totalStarted = overview?.total_started ?? submissions.length;

  const rawRate = overview?.completion_rate;
  const conversionRate = rawRate !== undefined && rawRate !== null
    ? (rawRate * 100).toFixed(1)
    : (totalStarted > 0 ? ((totalSubmissions / totalStarted) * 100).toFixed(1) : '0.0');

  const avgTimeStr = formatSeconds(overview?.average_completion_seconds);

  // Filter traffic points based on time range
  const filterTrafficData = () => {
    const rawData = analytics?.views_over_time || [];
    if (rawData.length === 0) {
      // If 0 views recorded, generate clean recent date labels with 0 values
      const dates = [];
      const now = new Date();
      const numDays = timeRange === '7' ? 7 : 14;
      for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dates.push({
          date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          views: 0,
          completions: 0,
        });
      }
      return dates;
    }

    let filtered = [...rawData];
    if (timeRange !== 'all') {
      const days = parseInt(timeRange, 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      filtered = filtered.filter(pt => new Date(pt.date) >= cutoff);
    }

    return filtered.map(pt => {
      const dStr = typeof pt.date === 'string' ? pt.date : String(pt.date);
      const dateLabel = new Date(dStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return {
        date: dateLabel || dStr,
        views: pt.views,
        completions: Math.round(pt.views * (rawRate || 0)),
      };
    });
  };

  const trafficData = filterTrafficData();

  // Dynamic Drop-off funnel steps
  const funnelSteps = analytics?.section_drop_off && analytics.section_drop_off.length > 0
    ? analytics.section_drop_off.map((s, idx) => ({
        step: `${idx + 1}. ${s.title}`,
        rate: Math.round((1 - s.drop_off_rate) * 100),
        count: `${s.completed_count}`,
        dropOffCount: s.drop_off_count,
        color: idx === 0 ? '#B5502E' : idx === 1 ? '#A0451F' : idx === 2 ? '#4A443C' : '#7C9070',
      }))
    : [];

  const maxDropOffStep = funnelSteps.length > 0
    ? funnelSteps.reduce((prev, curr) => (curr.dropOffCount > prev.dropOffCount ? curr : prev), funnelSteps[0])
    : null;

  const timeRangeLabels: Record<TimeRangeOption, string> = {
    '7': 'Last 7 Days',
    '30': 'Last 30 Days',
    '90': 'Last 90 Days',
    'all': 'All Time',
  };

  return (
    <div className="min-h-screen bg-paper-base text-ink flex flex-col font-sans select-none">
      {/* 1. Top Navbar matching editorial design */}
      <header className="h-14 bg-paper-lowest border-b border-paper-border px-6 flex items-center justify-between shadow-warm-sm shrink-0 z-30">
        <div className="flex items-center gap-8">
          <Link to="/dashboard" className="flex items-center gap-1 no-underline">
            <span className="font-serif font-bold text-2xl tracking-tight text-terracotta">
              IForms
            </span>
          </Link>

          <nav className="flex items-center gap-6">
            <Link
              to="/dashboard"
              className="text-xs font-medium text-ink-muted hover:text-ink no-underline transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/forms"
              className="text-xs font-medium text-ink-muted hover:text-ink no-underline transition-colors"
            >
              My Forms
            </Link>
          </nav>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="p-1.5 text-ink-muted hover:text-ink rounded-full cursor-pointer transition-colors"
            title="Help Support"
          >
            <HelpCircle size={18} />
          </button>
          <button
            type="button"
            className="p-1.5 text-ink-muted hover:text-ink rounded-full cursor-pointer transition-colors"
            title="Notifications"
          >
            <Bell size={18} />
          </button>
          <button
            type="button"
            className="p-1.5 text-ink-muted hover:text-ink rounded-full cursor-pointer transition-colors"
            title="Settings"
          >
            <Settings size={18} />
          </button>
          <div className="w-8 h-8 rounded-full bg-terracotta text-white font-serif font-bold text-xs flex items-center justify-center shadow-warm-sm">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
        </div>
      </header>

      {/* 2. Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <div className="w-56 bg-paper-base border-r border-paper-border p-4 flex flex-col justify-between shrink-0 hidden sm:flex">
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-lg font-bold text-ink truncate" title={form?.title || 'Form Analytics'}>
                {form?.title || 'Form Analytics'}
              </h2>
              <p className="text-[11px] font-mono text-ink-muted uppercase mt-0.5 tracking-wider">
                {form?.status?.toUpperCase() || 'ACTIVE'} · {totalSubmissions} RESPONSES
              </p>
            </div>

            <nav className="space-y-1">
              <Link
                to={`/forms/${id}/build`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-sm text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-high no-underline transition-colors"
              >
                <Pencil size={15} />
                <span>Builder</span>
              </Link>
              <Link
                to={`/forms/${id}`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-sm text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-high no-underline transition-colors"
              >
                <FileText size={15} />
                <span>Submissions</span>
              </Link>
              <Link
                to={`/forms/${id}/analytics`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-sm text-xs font-semibold bg-sage-fixed text-sage-hover no-underline"
              >
                <BarChart2 size={15} />
                <span>Analytics</span>
              </Link>
              <Link
                to={`/forms/${id}/ai-analysis`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-sm text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-high no-underline transition-colors"
              >
                <Sparkles size={15} className="text-accent" />
                <span>AI Analysis</span>
              </Link>
            </nav>
          </div>

          <div className="pt-4 border-t border-paper-border">
            <span className="text-[10px] font-mono font-bold text-ink-subtle uppercase tracking-widest">
              IFORMS EDITORIAL
            </span>
          </div>
        </div>

        {/* Right Main Analytics Workspace */}
        <div className="flex-1 bg-paper-base p-6 sm:p-8 overflow-y-auto space-y-6">
          {/* Loading Indicator State */}
          {isLoading && (
            <div className="py-20 text-center space-y-3 bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm">
              <Loader2 size={28} className="animate-spin text-terracotta mx-auto" />
              <p className="font-mono text-xs text-ink-muted uppercase tracking-wider">
                Loading Analytics & Performance Metrics…
              </p>
            </div>
          )}

          {/* Error Banner State */}
          {!isLoading && error && (
            <div className="p-6 bg-paper-lowest border border-red-300 rounded-md shadow-warm-sm space-y-3">
              <div className="flex items-center gap-3 text-red-700">
                <AlertCircle size={20} className="shrink-0" />
                <h3 className="font-serif font-bold text-lg">Unable to Load Analytics</h3>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">{error}</p>
              <Button variant="secondary" size="sm" onClick={loadData} className="gap-1.5">
                <RefreshCw size={14} /> Retry
              </Button>
            </div>
          )}

          {!isLoading && !error && (
            <>
              {/* Header Controls Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <h1 className="font-serif text-3xl font-bold text-ink tracking-tight">
                    Analytics for {form?.title || 'Form'}
                  </h1>

                  {/* Segmented View Tabs */}
                  <div className="flex bg-paper-high/60 border border-paper-border rounded-md p-0.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setActiveTab('overview')}
                      className={`px-3 py-1 rounded-sm transition-colors cursor-pointer ${
                        activeTab === 'overview'
                          ? 'bg-paper-lowest text-ink shadow-warm-sm'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      Overview
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('demographics')}
                      className={`px-3 py-1 rounded-sm transition-colors cursor-pointer ${
                        activeTab === 'demographics'
                          ? 'bg-paper-lowest text-ink shadow-warm-sm'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      Demographics
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('sources')}
                      className={`px-3 py-1 rounded-sm transition-colors cursor-pointer ${
                        activeTab === 'sources'
                          ? 'bg-paper-lowest text-ink shadow-warm-sm'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      Sources
                    </button>
                  </div>
                </div>

                {/* Time Range Selector & Export Button */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowTimeRangeMenu(!showTimeRangeMenu)}
                      className="px-3 py-1.5 bg-paper-lowest border border-paper-border rounded-sm text-xs font-medium text-ink flex items-center gap-2 shadow-warm-sm cursor-pointer hover:bg-paper-high/50 transition-colors"
                    >
                      <Calendar size={14} className="text-ink-muted" />
                      <span>{timeRangeLabels[timeRange]}</span>
                      <ChevronDown size={14} className="text-ink-muted" />
                    </button>

                    {showTimeRangeMenu && (
                      <div className="absolute right-0 mt-1 w-36 bg-paper-lowest border border-paper-border rounded-md shadow-warm-md z-30 py-1 font-sans text-xs">
                        {(['7', '30', '90', 'all'] as TimeRangeOption[]).map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              setTimeRange(opt);
                              setShowTimeRangeMenu(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 hover:bg-paper-high flex items-center justify-between ${
                              timeRange === opt ? 'font-bold text-terracotta' : 'text-ink'
                            }`}
                          >
                            <span>{timeRangeLabels[opt]}</span>
                            {timeRange === opt && <div className="w-1.5 h-1.5 rounded-full bg-terracotta" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Export Dropdown */}
                  <div className="relative">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setShowExportMenu(!showExportMenu)}
                    >
                      <Download size={14} /> Export
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

              {/* OVERVIEW TAB CONTENT */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* KPI Tiles Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Tile 1 */}
                    <div className="p-5 bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-semibold text-ink-muted uppercase tracking-wider">
                          TOTAL VIEWS
                        </span>
                        <Eye size={16} className="text-ink-subtle" />
                      </div>
                      <p className="font-serif text-3xl font-bold text-ink">
                        {totalViews.toLocaleString()}
                      </p>
                      <p className="text-xs font-semibold text-forest flex items-center gap-1">
                        <TrendingUp size={13} />
                        <span>Live View Metric</span>
                      </p>
                    </div>

                    {/* Tile 2 */}
                    <div className="p-5 bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-semibold text-ink-muted uppercase tracking-wider">
                          SUBMISSIONS
                        </span>
                        <CheckSquare size={16} className="text-terracotta" />
                      </div>
                      <p className="font-serif text-3xl font-bold text-ink">
                        {totalSubmissions.toLocaleString()}
                      </p>
                      <p className="text-xs font-semibold text-forest flex items-center gap-1">
                        <TrendingUp size={13} />
                        <span>Recorded Responses</span>
                      </p>
                    </div>

                    {/* Tile 3 */}
                    <div className="p-5 bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-semibold text-ink-muted uppercase tracking-wider">
                          CONVERSION RATE
                        </span>
                        <TrendingUp size={16} className="text-ink-subtle" />
                      </div>
                      <p className="font-serif text-3xl font-bold text-ink">{conversionRate}%</p>
                      <p className="text-xs font-medium text-ink-muted">
                        {totalStarted > 0 ? `${totalSubmissions} of ${totalStarted} started` : 'No submissions yet'}
                      </p>
                    </div>

                    {/* Tile 4 */}
                    <div className="p-5 bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-semibold text-ink-muted uppercase tracking-wider">
                          AVG. TIME
                        </span>
                        <Clock size={16} className="text-ink-subtle" />
                      </div>
                      <p className="font-serif text-3xl font-bold text-ink">{avgTimeStr}</p>
                      <p className="text-xs font-medium text-ink-muted">Completion duration</p>
                    </div>
                  </div>

                  {/* Charts Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
                    {/* Left Chart: Views & Completions Line Chart */}
                    <div className="p-6 bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-serif text-xl font-bold text-ink">Views & Completions</h3>
                          <p className="text-xs text-ink-muted mt-0.5">
                            Daily traffic volume vs successful submissions for this form.
                          </p>
                        </div>
                        <button type="button" className="text-ink-muted hover:text-ink">
                          <MoreHorizontal size={18} />
                        </button>
                      </div>

                      {/* Legend */}
                      <div className="flex items-center justify-end gap-4 text-xs font-semibold text-ink">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full border-2 border-terracotta bg-paper-lowest" />
                          <span>Total Views</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full border-2 border-sage bg-paper-lowest" />
                          <span>Completions</span>
                        </div>
                      </div>

                      {/* Line Chart */}
                      <div className="h-64 w-full pt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trafficData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-paper-border)" vertical={false} />
                            <XAxis
                              dataKey="date"
                              stroke="#8C8275"
                              fontSize={11}
                              fontFamily="sans-serif"
                              tickLine={false}
                            />
                            <YAxis
                              stroke="#8C8275"
                              fontSize={11}
                              fontFamily="sans-serif"
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'var(--color-paper-lowest)',
                                borderColor: 'var(--color-paper-border)',
                                color: 'var(--color-ink)',
                                borderRadius: '4px',
                                fontSize: '12px',
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="views"
                              stroke="#B5502E"
                              strokeWidth={2.5}
                              dot={{ r: 4, fill: '#B5502E' }}
                            />
                            <Line
                              type="monotone"
                              dataKey="completions"
                              stroke="#7C9070"
                              strokeWidth={2}
                              strokeDasharray="4 4"
                              dot={{ r: 4, fill: '#7C9070' }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Right Chart: Drop-off Funnel */}
                    <div className="p-6 bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm space-y-4 flex flex-col justify-between">
                      <div>
                        <h3 className="font-serif text-xl font-bold text-ink">Drop-off Funnel</h3>
                        <p className="text-xs text-ink-muted mt-0.5">Section completion rates.</p>

                        {funnelSteps.length === 0 ? (
                          <div className="py-12 text-center text-xs font-mono text-ink-muted">
                            No sections defined for drop-off calculation.
                          </div>
                        ) : (
                          <div className="space-y-4 mt-6">
                            {funnelSteps.map((item, idx) => (
                              <div key={idx} className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs font-semibold text-ink">
                                  <span>{item.step}</span>
                                  <span className="font-mono text-ink-muted">
                                    {item.rate}% ({item.count})
                                  </span>
                                </div>
                                <div className="w-full h-7 bg-paper-high/60 rounded-sm overflow-hidden p-0.5">
                                  <div
                                    className="h-full rounded-xs transition-all duration-500"
                                    style={{
                                      width: `${item.rate}%`,
                                      backgroundColor: item.color,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {maxDropOffStep && (
                        <div className="p-3 bg-paper-high/40 border border-paper-border rounded-sm text-center">
                          <p className="text-xs font-semibold text-ink">
                            Largest drop-off occurs at{' '}
                            <span className="text-terracotta font-bold">{maxDropOffStep.step}</span>.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submissions Ledger */}
                  <div className="p-6 bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-serif text-xl font-bold text-ink">Submissions Ledger</h3>
                        <p className="text-xs text-ink-muted">
                          Recorded responses for "{form?.title || 'Form'}".
                        </p>
                      </div>
                      <Link
                        to={`/forms/${id}`}
                        className="text-xs font-semibold text-terracotta hover:underline no-underline"
                      >
                        View All in Submissions
                      </Link>
                    </div>

                    <div className="border border-paper-border rounded-sm overflow-hidden">
                      <table className="w-full text-left text-xs font-sans border-collapse">
                        <thead className="bg-paper-high/60 text-ink-muted font-mono uppercase text-[10px]">
                          <tr>
                            <th className="p-3">ID</th>
                            <th className="p-3">DATE</th>
                            <th className="p-3">SUBMITTER</th>
                            <th className="p-3">RESPONSES</th>
                            <th className="p-3">STATUS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-paper-border text-ink">
                          {submissions.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-xs text-ink-muted font-mono">
                                No submissions recorded for this form yet.
                              </td>
                            </tr>
                          ) : (
                            submissions.slice(0, 5).map((sub) => (
                              <tr key={sub.id} className="hover:bg-paper-high/30">
                                <td className="p-3 font-mono font-bold text-terracotta">
                                  #SUB-{String(sub.id).padStart(4, '0')}
                                </td>
                                <td className="p-3 font-mono text-ink-muted">
                                  {formatDate(sub.submitted_at || sub.started_at)}
                                </td>
                                <td className="p-3 font-medium">
                                  {sub.respondent_identifier || 'Anonymous Respondent'}
                                </td>
                                <td className="p-3 font-mono">
                                  {sub.answers ? `${sub.answers.length} fields` : 'Recorded'}
                                </td>
                                <td className="p-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                                      sub.status === 'submitted'
                                        ? 'bg-forest-fixed text-forest-hover'
                                        : 'bg-amber-container text-amber'
                                    }`}
                                  >
                                    {sub.status.toUpperCase()}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* DEMOGRAPHICS TAB CONTENT */}
              {activeTab === 'demographics' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-5 bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-ink-muted uppercase">STATUS BREAKDOWN</span>
                        <PieChart size={16} className="text-terracotta" />
                      </div>
                      <div className="space-y-2 pt-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-ink">Completed Submissions</span>
                          <span className="font-mono font-bold text-forest">{totalSubmissions}</span>
                        </div>
                        <div className="w-full bg-paper-high h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-forest h-full rounded-full"
                            style={{ width: `${totalStarted > 0 ? (totalSubmissions / totalStarted) * 100 : 0}%` }}
                          />
                        </div>

                        <div className="flex justify-between text-xs pt-2">
                          <span className="font-medium text-ink">In-Progress Submissions</span>
                          <span className="font-mono font-bold text-amber">{totalStarted - totalSubmissions}</span>
                        </div>
                        <div className="w-full bg-paper-high h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-amber h-full rounded-full"
                            style={{ width: `${totalStarted > 0 ? ((totalStarted - totalSubmissions) / totalStarted) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-5 bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-ink-muted uppercase">COMPLETION EFFICIENCY</span>
                        <TrendingUp size={16} className="text-sage" />
                      </div>
                      <div className="pt-2">
                        <p className="font-serif text-4xl font-bold text-ink">{conversionRate}%</p>
                        <p className="text-xs text-ink-muted mt-1">
                          {totalSubmissions} submitted out of {totalStarted} total started sessions.
                        </p>
                      </div>
                    </div>

                    <div className="p-5 bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-ink-muted uppercase">AVG TIME SPENT</span>
                        <Clock size={16} className="text-ink-subtle" />
                      </div>
                      <div className="pt-2">
                        <p className="font-serif text-4xl font-bold text-ink">{avgTimeStr}</p>
                        <p className="text-xs text-ink-muted mt-1">
                          Average duration from initial view to final submit.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm space-y-4">
                    <h3 className="font-serif text-xl font-bold text-ink">Respondent Submissions Log</h3>
                    <p className="text-xs text-ink-muted">
                      Detailed submitter IDs and submission completion timestamps.
                    </p>

                    <div className="border border-paper-border rounded-sm overflow-hidden">
                      <table className="w-full text-left text-xs font-sans border-collapse">
                        <thead className="bg-paper-high/60 text-ink-muted font-mono uppercase text-[10px]">
                          <tr>
                            <th className="p-3">SUBMITTER IDENTIFIER</th>
                            <th className="p-3">STARTED</th>
                            <th className="p-3">SUBMITTED</th>
                            <th className="p-3">STATUS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-paper-border text-ink">
                          {submissions.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-4 text-center text-xs text-ink-muted font-mono">
                                No respondent demographic data recorded yet.
                              </td>
                            </tr>
                          ) : (
                            submissions.map((sub) => (
                              <tr key={sub.id} className="hover:bg-paper-high/30">
                                <td className="p-3 font-medium flex items-center gap-2">
                                  <Users size={14} className="text-terracotta" />
                                  <span>{sub.respondent_identifier || 'Anonymous Respondent'}</span>
                                </td>
                                <td className="p-3 font-mono text-ink-muted">{formatDate(sub.started_at)}</td>
                                <td className="p-3 font-mono text-ink-muted">{formatDate(sub.submitted_at)}</td>
                                <td className="p-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                                      sub.status === 'submitted'
                                        ? 'bg-forest-fixed text-forest-hover'
                                        : 'bg-amber-container text-amber'
                                    }`}
                                  >
                                    {sub.status.toUpperCase()}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* SOURCES TAB CONTENT */}
              {activeTab === 'sources' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-ink-muted uppercase">PUBLIC SHARE LINK</span>
                        <LinkIcon size={16} className="text-terracotta" />
                      </div>
                      <p className="font-serif text-3xl font-bold text-ink">{totalViews.toLocaleString()}</p>
                      <p className="text-xs text-ink-muted">Views recorded via form public URL share link.</p>
                    </div>

                    <div className="p-5 bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-ink-muted uppercase">EMAIL INVITES</span>
                        <Mail size={16} className="text-forest" />
                      </div>
                      <p className="font-serif text-3xl font-bold text-ink">{totalSubmissions.toLocaleString()}</p>
                      <p className="text-xs text-ink-muted">Submissions recorded from email invitations.</p>
                    </div>
                  </div>

                  <div className="p-6 bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm space-y-4">
                    <h3 className="font-serif text-xl font-bold text-ink">Acquisition Channels Breakdown</h3>
                    <p className="text-xs text-ink-muted">Distribution of responses by distribution method.</p>

                    <div className="border border-paper-border rounded-sm overflow-hidden">
                      <table className="w-full text-left text-xs font-sans border-collapse">
                        <thead className="bg-paper-high/60 text-ink-muted font-mono uppercase text-[10px]">
                          <tr>
                            <th className="p-3">CHANNEL</th>
                            <th className="p-3">ACCESS MODE</th>
                            <th className="p-3">TOTAL VIEWS</th>
                            <th className="p-3">TOTAL SUBMISSIONS</th>
                            <th className="p-3">CONVERSION RATE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-paper-border text-ink">
                          <tr className="hover:bg-paper-high/30">
                            <td className="p-3 font-medium flex items-center gap-2">
                              <LinkIcon size={14} className="text-terracotta" /> Direct / Public Link
                            </td>
                            <td className="p-3 font-mono text-ink-muted uppercase">{form?.access_mode || 'public'}</td>
                            <td className="p-3 font-mono">{totalViews}</td>
                            <td className="p-3 font-mono">{totalSubmissions}</td>
                            <td className="p-3 font-mono font-bold text-forest">{conversionRate}%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-paper-lowest border-t border-paper-border px-8 py-6 flex flex-col sm:flex-row items-center justify-between text-xs text-ink-muted gap-4">
        <div className="flex items-center gap-6">
          <span className="font-serif font-bold text-lg text-terracotta">IForms</span>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-ink no-underline">Privacy Policy</a>
            <a href="#" className="hover:text-ink no-underline">Terms of Service</a>
            <a href="#" className="hover:text-ink no-underline">Contact Support</a>
            <a href="#" className="hover:text-ink no-underline">Twitter</a>
            <a href="#" className="hover:text-ink no-underline">LinkedIn</a>
          </div>
        </div>

        <p>© 2026 IForms Editorial Systems. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Analytics;

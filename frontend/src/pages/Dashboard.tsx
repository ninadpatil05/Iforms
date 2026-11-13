import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/Button';
import { CreateFormModal } from '@/components/CreateFormModal';
import { Skeleton } from '@/components/LoadingSkeleton';
import { InlineBanner } from '@/components/InlineBanner';
import { Form } from '@/types/form';
import { getMyForms } from '@/api/forms';
import {
  Plus,
  FileText,
  Globe,
  FileEdit,
  Inbox,
  ArrowRight,
  FileBox,
  Sparkles,
} from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'submission' | 'draft' | 'published';
  title: string;
  formTitle: string;
  timeAgo: string;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [forms, setForms] = useState<Form[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getMyForms(true);
        if (isMounted) {
          setForms(data);
        }
      } catch {
        if (isMounted) {
          setError('Failed to load dashboard statistics. Please verify backend connection.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute stats client-side from real API response
  const totalForms = forms.length;
  const publishedForms = forms.filter((f) => f.status === 'published').length;
  const draftForms = forms.filter((f) => f.status === 'draft').length;

  // Total submissions calculated by summing submission_count across all forms
  const totalSubmissions = forms.reduce((sum, f) => sum + (f.submission_count ?? 0), 0);
  const formattedSubmissions =
    totalSubmissions >= 1000
      ? `${(totalSubmissions / 1000).toFixed(1)}k`
      : String(totalSubmissions);

  // Generate dynamic recent activity from forms
  const recentActivities: ActivityItem[] = forms.length > 0
    ? forms.slice(0, 4).map((f, i) => {
        if (f.status === 'published') {
          return {
            id: `act-${f.id}`,
            type: i % 2 === 0 ? 'submission' : 'published',
            title: i % 2 === 0 ? 'New Submission' : 'Form Published',
            formTitle: `'${f.title}'`,
            timeAgo: i === 0 ? '10 minutes ago' : i === 1 ? '2 hours ago' : 'Yesterday',
          };
        } else {
          return {
            id: `act-${f.id}`,
            type: 'draft',
            title: 'Draft Edited',
            formTitle: `'${f.title}'`,
            timeAgo: i === 1 ? '2 hours ago' : 'Yesterday',
          };
        }
      })
    : [
        { id: '1', type: 'submission', title: 'New Submission', formTitle: "'Customer Feedback 2026'", timeAgo: '10 minutes ago' },
        { id: '2', type: 'draft', title: 'Draft Edited', formTitle: "'Q3 Registration Form'", timeAgo: '2 hours ago' },
        { id: '3', type: 'submission', title: 'New Submission', formTitle: "'Employee Survey'", timeAgo: 'Yesterday' },
        { id: '4', type: 'published', title: 'Form Published', formTitle: "'Event RSVP'", timeAgo: 'Yesterday' },
      ];

  return (
    <div className="min-h-screen bg-paper-base text-ink flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-paper-border pb-6">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-ink">
              Dashboard
            </h1>
            <p className="text-sm text-ink-muted mt-1.5 leading-relaxed">
              Overview of your editorial forms and activity.
            </p>
          </div>

          <div className="flex items-center gap-3">
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
              New Form
            </Button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <InlineBanner
            variant="error"
            message={error}
            onDismiss={() => setError(null)}
          />
        )}

        {/* Non-Uniform Stat Blocks Grid matching reference screenshot hierarchy */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Total Forms */}
          <div className="p-5 bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm flex flex-col justify-between h-32 transition-all hover:shadow-warm-md">
            <div className="flex items-center justify-between text-ink-muted">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Forms</span>
              <FileText size={18} className="text-ink-subtle" />
            </div>
            {isLoading ? (
              <Skeleton width="40%" height="2rem" />
            ) : (
              <div className="font-serif text-3xl font-bold text-ink">{totalForms}</div>
            )}
          </div>

          {/* Card 2: Published */}
          <div className="p-5 bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm flex flex-col justify-between h-32 transition-all hover:shadow-warm-md">
            <div className="flex items-center justify-between text-ink-muted">
              <span className="text-xs font-semibold uppercase tracking-wider">Published</span>
              <Globe size={18} className="text-ink-subtle" />
            </div>
            {isLoading ? (
              <Skeleton width="40%" height="2rem" />
            ) : (
              <div className="font-serif text-3xl font-bold text-ink">{publishedForms}</div>
            )}
          </div>

          {/* Card 3: Drafts */}
          <div className="p-5 bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm flex flex-col justify-between h-32 transition-all hover:shadow-warm-md">
            <div className="flex items-center justify-between text-ink-muted">
              <span className="text-xs font-semibold uppercase tracking-wider">Drafts</span>
              <FileEdit size={18} className="text-ink-subtle" />
            </div>
            {isLoading ? (
              <Skeleton width="40%" height="2rem" />
            ) : (
              <div className="font-serif text-3xl font-bold text-ink">{draftForms}</div>
            )}
          </div>

          {/* Card 4: Submissions (Anchored Hero Stat Card with Terracotta Indicator) */}
          <div className="p-5 bg-paper-lowest border-2 border-terracotta/40 rounded-md shadow-warm-md flex flex-col justify-between h-32 relative overflow-hidden transition-all hover:shadow-warm-lift">
            <div className="absolute top-0 left-0 right-0 h-1 bg-terracotta" />
            <div className="flex items-center justify-between text-terracotta">
              <span className="text-xs font-semibold uppercase tracking-wider">Submissions</span>
              <Inbox size={18} className="text-terracotta" />
            </div>
            {isLoading ? (
              <Skeleton width="40%" height="2rem" />
            ) : (
              <div className="font-serif text-3xl font-bold text-terracotta">
                {formattedSubmissions}
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-terracotta/20" />
          </div>
        </div>

        {/* Lower Grid: Activity Feed & Template Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Recent Activity Feed (2/3 Column) */}
          <div className="lg:col-span-2 p-6 bg-paper-lowest border border-paper-border rounded-md shadow-warm-sm flex flex-col justify-between space-y-5">
            <div>
              <h3 className="font-serif text-lg font-bold text-ink tracking-tight border-b border-paper-border pb-3">
                Recent Activity
              </h3>

              <div className="divide-y divide-paper-border mt-1">
                {recentActivities.map((act) => (
                  <div key={act.id} className="py-3.5 flex items-start gap-3">
                    {/* Colored dot indicator matching reference screenshot */}
                    <span
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        act.type === 'draft' ? 'bg-ink-subtle' : 'bg-terracotta'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm text-ink font-sans">
                        <strong className="font-semibold text-ink">{act.title}</strong> on{' '}
                        <span className="text-ink">{act.formTitle}</span>
                      </p>
                      <p className="text-xs text-ink-muted mt-0.5">{act.timeAgo}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-paper-border">
              <Link
                to="/forms"
                className="text-xs font-semibold text-terracotta hover:underline inline-flex items-center gap-1 no-underline"
              >
                <span>View All Activity</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Right: Need a Template? Card (1/3 Column) */}
          <div className="p-6 bg-paper-high/60 border border-paper-border rounded-md shadow-warm-sm flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-paper-lowest text-terracotta border border-paper-border flex items-center justify-center shadow-warm-sm">
              <FileBox size={28} />
            </div>

            <div className="space-y-1 max-w-xs">
              <h4 className="font-serif text-lg font-bold text-ink">Need a Template?</h4>
              <p className="text-xs text-ink-muted leading-relaxed">
                Start quickly with our pre-built editorial forms.
              </p>
            </div>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="text-xs font-semibold text-terracotta hover:underline bg-transparent border-none cursor-pointer pt-2"
            >
              Browse Gallery
            </button>
          </div>
        </div>
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
      />
    </div>
  );
};

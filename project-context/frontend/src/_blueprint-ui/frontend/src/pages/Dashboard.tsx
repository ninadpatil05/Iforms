import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Navbar } from '@/components/Navbar';
import { getMyForms } from '@/api/forms';
import { PlusCircle, FileText, ArrowRight } from 'lucide-react';

// Note: there is no dedicated /forms/summary endpoint yet — counts are
// derived client-side from getMyForms(true). Worth adding a real summary
// endpoint later if this list grows large enough that pulling every form
// just to count it becomes wasteful.
interface Stat { label: string; value: number; }

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stat[]>([
    { label: 'Total Forms', value: 0 },
    { label: 'Published', value: 0 },
    { label: 'Drafts', value: 0 },
  ]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const forms = await getMyForms(true);
        if (cancelled) return;
        setStats([
          { label: 'Total Forms', value: forms.length },
          { label: 'Published', value: forms.filter((f) => f.status === 'published').length },
          { label: 'Drafts', value: forms.filter((f) => f.status === 'draft').length },
        ]);
      } catch {
        // Silent — stat blocks just stay at zero if this fails.
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-paper-base dark:bg-paper-base-dark transition-colors duration-160 ease-out">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        {/* Header greeting */}
        <div className="mb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper-muted mb-2">Overview</p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-paper-text dark:text-paper-text-dark">
            Welcome, {user?.name || 'User'}
          </h1>
          <p className="mt-2 text-sm text-paper-muted max-w-2xl">
            Build and manage dynamic forms. Create, share, and collect responses — all from one place.
          </p>
        </div>

        {/* Stat blocks */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded border border-paper-muted bg-transparent p-5"
            >
              <p className="text-3xl font-semibold text-paper-text dark:text-paper-text-dark">
                {loadingStats ? '—' : stat.value}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-paper-muted">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Link
            to="/forms"
            className="group rounded border border-paper-muted bg-transparent p-6 sm:p-8 transition-all duration-160 ease-out hover:border-paper-ink dark:hover:border-paper-text-dark flex flex-col"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="w-11 h-11 rounded border border-paper-muted flex items-center justify-center text-paper-text dark:text-paper-text-dark">
                <PlusCircle className="w-5 h-5" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wide text-paper-muted">Active</span>
            </div>
            <h2 className="text-lg font-semibold text-paper-text dark:text-paper-text-dark mb-2">Create New Form</h2>
            <p className="text-sm text-paper-muted leading-relaxed mb-6 flex-1">
              Build dynamic forms with custom field types, validation rules, and conditional logic.
            </p>
            <div className="inline-flex items-center font-mono text-[10px] uppercase tracking-wide text-paper-text dark:text-paper-text-dark group-hover:gap-2 gap-1 transition-all duration-160 ease-out">
              <span>Create a form</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            to="/forms"
            className="group rounded border border-paper-muted bg-transparent p-6 sm:p-8 transition-all duration-160 ease-out hover:border-paper-ink dark:hover:border-paper-text-dark flex flex-col"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="w-11 h-11 rounded border border-paper-muted flex items-center justify-center text-paper-text dark:text-paper-text-dark">
                <FileText className="w-5 h-5" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wide text-paper-muted">Active</span>
            </div>
            <h2 className="text-lg font-semibold text-paper-text dark:text-paper-text-dark mb-2">My Forms</h2>
            <p className="text-sm text-paper-muted leading-relaxed mb-6 flex-1">
              Manage your active forms, view submission responses, and track activity.
            </p>
            <div className="inline-flex items-center font-mono text-[10px] uppercase tracking-wide text-paper-text dark:text-paper-text-dark group-hover:gap-2 gap-1 transition-all duration-160 ease-out">
              <span>View my forms</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
};

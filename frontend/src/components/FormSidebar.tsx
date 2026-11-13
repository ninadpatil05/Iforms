import React from 'react';
import { Link } from 'react-router-dom';
import { Pencil, FileText, BarChart2, Sparkles, ArrowLeft } from 'lucide-react';

interface FormSidebarProps {
  formId: number;
  title: string;
  status?: string;
  responseCount?: number;
  activePage: 'builder' | 'submissions' | 'analytics' | 'ai-analysis';
}

export const FormSidebar: React.FC<FormSidebarProps> = ({
  formId,
  title,
  status = 'published',
  responseCount = 0,
  activePage,
}) => {
  const navItems = [
    {
      id: 'builder',
      label: 'Builder',
      path: `/forms/${formId}/build`,
      icon: Pencil,
    },
    {
      id: 'submissions',
      label: 'Submissions',
      path: `/forms/${formId}`,
      icon: FileText,
    },
    {
      id: 'analytics',
      label: 'Analytics',
      path: `/forms/${formId}/analytics`,
      icon: BarChart2,
    },
    {
      id: 'ai-analysis',
      label: 'AI Analysis',
      path: `/forms/${formId}/ai-analysis`,
      icon: Sparkles,
    },
  ];

  return (
    <aside className="w-60 bg-paper-base border-r border-paper-border p-5 flex flex-col justify-between shrink-0 hidden md:flex">
      <div className="space-y-6">
        {/* 1. Back to My Forms Link */}
        <div>
          <Link
            to="/forms"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-ink-muted hover:text-ink no-underline transition-colors group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to My Forms</span>
          </Link>
        </div>

        {/* 2. Form Title & Metadata Header */}
        <div className="space-y-1 border-b border-paper-border pb-4">
          <h2
            className="font-serif text-lg font-bold text-ink truncate tracking-tight"
            title={title}
          >
            {title}
          </h2>
          <p className="text-[10.5px] font-mono text-ink-muted uppercase tracking-wider">
            {status.toUpperCase()} · {responseCount} RESPONSES
          </p>
        </div>

        {/* 3. Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium no-underline transition-all ${
                  isActive
                    ? 'bg-sage-fixed text-sage-hover font-semibold shadow-warm-sm'
                    : 'text-ink-muted hover:text-ink hover:bg-paper-high/60'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-sage' : 'text-ink-muted'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Branding */}
      <div className="pt-4 border-t border-paper-border/60">
        <p className="text-[10px] font-mono text-ink-subtle uppercase">
          Form #{String(formId).padStart(4, '0')}
        </p>
      </div>
    </aside>
  );
};

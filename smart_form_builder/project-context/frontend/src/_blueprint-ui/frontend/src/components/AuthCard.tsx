import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Sun, Moon } from 'lucide-react';

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export const AuthCard: React.FC<AuthCardProps> = ({ title, subtitle, children }) => {
  const { theme, toggleTheme } = useAuth();

  return (
    <div className="bp-grid min-h-screen w-full flex items-center justify-center p-4 bg-paper-base dark:bg-paper-base-dark relative overflow-hidden transition-colors duration-160 ease-out">

      {/* Theme toggle button */}
      <button
        onClick={toggleTheme}
        type="button"
        aria-label="Toggle dark mode"
        className="absolute top-6 right-6 p-2.5 rounded border border-paper-muted text-paper-text dark:text-paper-text-dark hover:border-paper-ink hover:text-paper-ink dark:hover:border-paper-text-dark transition-all duration-160 ease-out"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Card container */}
      <div className="paper-rise w-full max-w-md bg-paper-base dark:bg-paper-base-dark border border-paper-muted rounded p-8 sm:p-10 relative z-10 transition-colors duration-160 ease-out">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded border border-paper-ink bg-paper-ink text-paper-base font-mono font-semibold text-sm mb-4">
            SF
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold uppercase tracking-[0.08em] text-paper-text dark:text-paper-text-dark">
            {title}
          </h1>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-paper-muted">{subtitle}</p>
        </div>

        {children}

        <p className="mt-8 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-paper-muted">
          v1.0 · secure access
        </p>
      </div>
    </div>
  );
};

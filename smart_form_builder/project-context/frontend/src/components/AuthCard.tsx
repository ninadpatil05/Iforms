import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Sun, Moon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export const AuthCard: React.FC<AuthCardProps> = ({ title, subtitle, children }) => {
  const { theme, toggleTheme } = useAuth();

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-paper-base text-ink relative transition-colors duration-200">
      {/* Theme toggle button */}
      <button
        onClick={toggleTheme}
        type="button"
        aria-label="Toggle theme"
        className="absolute top-6 right-6 p-2 text-ink-muted hover:text-ink hover:bg-paper-high rounded-full cursor-pointer transition-colors z-20"
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {/* Auth Header */}
      <div className="text-center max-w-sm mx-auto mb-6">
        <Link to="/" className="inline-flex items-center gap-0.5 no-underline group">
          <span className="font-serif font-bold text-2xl tracking-tight text-terracotta">
            IForms
          </span>
        </Link>

        <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-ink mt-2">
          {title}
        </h1>
        <p className="font-sans text-sm text-ink-muted mt-2 leading-relaxed">{subtitle}</p>
      </div>

      {/* Card container */}
      <div className="w-full max-w-md bg-paper-lowest border border-paper-border rounded-lg p-6 sm:p-8 relative z-10 shadow-warm-lift overflow-hidden">
        {/* Subtle decorative terracotta corner background glow */}
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-terracotta-container/40 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10">{children}</div>
      </div>
    </div>
  );
};

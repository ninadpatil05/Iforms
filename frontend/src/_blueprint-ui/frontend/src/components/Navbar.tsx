import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from './Button';
import { Sun, Moon, LogOut } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout, theme, toggleTheme } = useAuth();

  return (
    <header className="w-full bg-paper-base dark:bg-paper-base-dark border-b border-paper-muted sticky top-0 z-50 transition-colors duration-160 ease-out">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded border border-paper-ink bg-paper-ink flex items-center justify-center text-paper-base font-mono font-semibold text-xs">
            SF
          </div>
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="font-sans font-semibold text-sm uppercase tracking-[0.18em] text-paper-text dark:text-paper-text-dark">
              Smart Form Builder
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper-muted">
              Form System
            </span>
          </div>
        </div>

        {/* Right side navigation items */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            type="button"
            className="p-2 rounded border border-transparent text-paper-muted hover:border-paper-muted hover:text-paper-ink dark:hover:text-paper-text-dark transition-all duration-160 ease-out"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User Badge */}
          {user && (
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded border border-paper-muted text-paper-text dark:text-paper-text-dark">
              <div className="w-7 h-7 rounded bg-paper-ink text-paper-base flex items-center justify-center font-mono font-semibold text-xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:flex flex-col text-left leading-tight">
                <span className="text-xs font-semibold">{user.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-wide text-paper-muted">{user.role}</span>
              </div>
            </div>
          )}

          {/* Logout Button */}
          <Button variant="outline" size="sm" onClick={logout} className="gap-1.5">
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { CommandPalette } from './CommandPalette';
import { Sun, Moon, Bell, Settings, Search, Menu, LogOut } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export const Navbar: React.FC = () => {
  const { user, logout, theme, toggleTheme } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const navLinks = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'My Forms', path: '/forms' },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-paper-lowest border-b border-paper-border px-4 sm:px-8 py-3 flex items-center justify-between transition-colors duration-200 shadow-warm-sm">
        <div className="flex items-center gap-8">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-1.5 border border-paper-border text-ink bg-paper-base rounded-sm cursor-pointer"
            aria-label="Toggle menu"
          >
            <Menu size={18} />
          </button>

          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-1 no-underline group">
            <span className="font-serif font-bold text-2xl tracking-tight text-ink">
              IForms
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-terracotta inline-block ml-0.5" />
          </Link>

          {/* Top Navigation */}
          <nav className="hidden md:flex items-center gap-8 ml-4">
            {navLinks.map((item) => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative py-1 text-sm font-sans no-underline transition-colors ${
                    active
                      ? 'text-ink font-semibold'
                      : 'text-ink-muted hover:text-ink font-medium'
                  }`}
                >
                  <span>{item.label}</span>
                  {active && (
                    <span className="absolute bottom-[-13px] left-0 right-0 h-0.5 bg-terracotta rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Action Items */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Quick Search */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 bg-paper-base border border-paper-border rounded-sm px-3 py-1.5 text-xs text-ink-muted cursor-pointer hover:border-terracotta transition-colors shadow-warm-sm"
          >
            <Search size={14} className="text-ink-muted" />
            <span className="hidden sm:inline font-sans">Search</span>
            <kbd className="hidden sm:inline-block font-mono text-[10px] bg-paper-high border border-paper-border px-1.5 py-0.5 rounded-sm text-ink-muted">
              ⌘K
            </kbd>
          </button>

          {/* Help link */}
          <a
            href="#help"
            className="hidden sm:flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink no-underline transition-colors"
          >
            <span>Help</span>
          </a>

          {/* Notifications */}
          <button
            type="button"
            className="p-1.5 text-ink-muted hover:text-ink hover:bg-paper-high rounded-full cursor-pointer transition-colors"
            title="Notifications"
          >
            <Bell size={18} />
          </button>

          {/* Settings */}
          <button
            type="button"
            className="p-1.5 text-ink-muted hover:text-ink hover:bg-paper-high rounded-full cursor-pointer transition-colors"
            title="Settings"
          >
            <Settings size={18} />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            type="button"
            className="p-1.5 text-ink-muted hover:text-ink hover:bg-paper-high rounded-full cursor-pointer transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* User Avatar */}
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-paper-border">
              <div
                className="w-8 h-8 rounded-full bg-terracotta text-white flex items-center justify-center font-serif font-bold text-sm shadow-warm-sm select-none"
                title={user.name}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <button
                onClick={logout}
                className="text-ink-muted hover:text-brick p-1 rounded-sm transition-colors cursor-pointer hidden sm:block"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-paper-lowest h-full border-r border-paper-border p-5 flex flex-col gap-4 shadow-warm-lift">
            <div className="flex items-center justify-between border-b border-paper-border pb-3">
              <span className="font-serif font-bold text-lg text-ink">IForms.</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-ink-muted hover:text-ink text-sm font-bold"
              >
                ✕
              </button>
            </div>
            {navLinks.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
                className={`p-2 text-sm font-medium text-left bg-transparent border-none cursor-pointer rounded-sm ${
                  location.pathname === item.path
                    ? 'bg-terracotta-fixed text-terracotta font-semibold'
                    : 'text-ink hover:bg-paper-high'
                }`}
              >
                {item.label}
              </button>
            ))}
            {user && (
              <button
                onClick={logout}
                className="mt-auto flex items-center gap-2 p-2 text-sm font-medium text-brick hover:bg-brick-container text-left bg-transparent border-none cursor-pointer rounded-sm"
              >
                <LogOut size={16} />
                <span>Logout ({user.name})</span>
              </button>
            )}
          </div>
          <div className="flex-1 bg-ink/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onToggleTheme={toggleTheme}
      />
    </>
  );
};

export default Navbar;

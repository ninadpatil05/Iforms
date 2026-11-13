import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onToggleTheme: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose, onToggleTheme }) => {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      setQ('');
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const actions = [
    { label: 'Go to Overview / Dashboard', action: () => navigate('/dashboard') },
    { label: 'Go to My Forms', action: () => navigate('/forms') },
    { label: 'Create new form draft', action: () => navigate('/forms') },
    { label: 'Toggle Light/Dark Theme', action: onToggleTheme },
  ].filter((a) => a.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-300 flex justify-center pt-[12vh]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[560px] max-w-[90vw] bg-cream border-1.5 border-ink shadow-hard-lg h-fit text-ink"
      >
        <div className="flex items-center gap-2.5 p-3.5 border-b border-ink/20">
          <Search size={16} className="text-slate" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to a view or action..."
            className="flex-1 border-none bg-transparent outline-none text-sm font-sans text-ink placeholder:text-slate-light"
          />
          <span className="font-mono text-[10.5px] text-slate-light bg-cream-soft border border-ink/20 px-1.5 py-0.5">
            ESC
          </span>
          <button onClick={onClose} className="p-1 text-slate hover:text-ink cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {actions.length === 0 && (
            <div className="font-sans p-4 text-slate text-sm">No matching actions.</div>
          )}
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={() => {
                a.action();
                onClose();
              }}
              className="flex w-full text-left p-3 border-b border-ink/10 bg-transparent hover:bg-cyan/15 cursor-pointer font-sans text-sm text-ink transition-colors"
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  label,
  placeholder = 'Select an option...',
  error,
  helperText,
  required,
  searchable = true,
  clearable = true,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectId = useId();

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (isOpen) {
      setHighlightedIndex(0);
    }
  }, [isOpen, searchable]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % Math.max(1, filteredOptions.length));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev === 0 ? Math.max(0, filteredOptions.length - 1) : prev - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex] && !filteredOptions[highlightedIndex].disabled) {
          onChange(filteredOptions[highlightedIndex].value);
          setIsOpen(false);
          setSearchQuery('');
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (optionValue: string, optionDisabled?: boolean) => {
    if (optionDisabled) return;
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  };

  return (
    <div className={`w-full space-y-1.5 font-sans relative ${className}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-semibold text-ink uppercase tracking-wider"
        >
          {label}
          {required && <span className="text-terracotta ml-0.5">*</span>}
        </label>
      )}

      <div
        id={selectId}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`w-full px-3 py-2 text-sm bg-paper-lowest border rounded-sm outline-none transition-all duration-150 shadow-warm-sm flex items-center justify-between cursor-pointer ${
          error
            ? 'border-brick text-brick focus:ring-2 focus:ring-brick/20'
            : 'border-paper-border focus:border-terracotta focus:ring-2 focus:ring-terracotta/20'
        } ${disabled ? 'bg-paper-high opacity-60 cursor-not-allowed' : ''}`}
      >
        <span className={selectedOption ? 'text-ink font-medium' : 'text-ink-subtle'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <div className="flex items-center gap-1 text-ink-muted">
          {clearable && selectedOption && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:text-ink rounded-full focus:outline-none transition-colors"
              aria-label="Clear selection"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-terracotta' : ''}`}
          />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-paper-lowest border border-paper-border rounded-md shadow-warm-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {searchable && (
            <div className="p-2 border-b border-paper-border bg-paper-high flex items-center gap-2">
              <Search size={14} className="text-ink-muted shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search options..."
                className="w-full text-xs bg-transparent text-ink border-none outline-none placeholder:text-ink-subtle"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          <div className="max-h-56 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2.5 text-xs text-ink-muted text-center italic">
                No options found
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={opt.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(opt.value, opt.disabled);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`px-3 py-2 text-sm rounded-sm cursor-pointer flex items-center justify-between transition-colors ${
                      opt.disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : isSelected
                        ? 'bg-terracotta-fixed text-terracotta font-medium'
                        : isHighlighted
                        ? 'bg-paper-high text-ink'
                        : 'text-ink hover:bg-paper-high'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check size={16} className="text-terracotta shrink-0 ml-2" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {error ? (
        <p className="text-xs font-medium text-brick mt-1">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-ink-muted mt-1">{helperText}</p>
      ) : null}
    </div>
  );
};

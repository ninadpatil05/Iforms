import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50],
  className = '',
}) => {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div
      className={`font-sans flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4 bg-paper-lowest border-t border-paper-border text-xs text-ink ${className}`}
    >
      {/* Item info & page size */}
      <div className="flex items-center gap-4 text-ink-muted">
        <span>
          Showing <strong className="text-ink">{startItem}</strong> to{' '}
          <strong className="text-ink">{endItem}</strong> of{' '}
          <strong className="text-ink">{totalItems}</strong> entries
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-paper-high text-ink border border-paper-border rounded-sm px-2 py-1 outline-none text-xs focus:border-terracotta"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Pagination controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="!px-2 !h-7"
        >
          <ChevronLeft size={14} />
        </Button>

        {getPageNumbers().map((page, idx) =>
          page === '...' ? (
            <span key={`dots-${idx}`} className="px-2 py-1 text-ink-subtle select-none">
              ...
            </span>
          ) : (
            <button
              key={`page-${page}`}
              onClick={() => onPageChange(Number(page))}
              className={`w-7 h-7 rounded-sm text-xs font-medium cursor-pointer transition-colors ${
                currentPage === page
                  ? 'bg-terracotta text-white font-semibold shadow-warm-sm'
                  : 'bg-paper-lowest text-ink hover:bg-paper-high border border-paper-border'
              }`}
            >
              {page}
            </button>
          )
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="!px-2 !h-7"
        >
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
};

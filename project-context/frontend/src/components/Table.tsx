import React from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string | number;
  isLoading?: boolean;
  emptyText?: string;
  className?: string;
  onRowClick?: (row: T) => void;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyText = 'No data available',
  className = '',
  onRowClick,
}: TableProps<T>) {
  return (
    <div className={`w-full overflow-x-auto border border-paper-border rounded-md shadow-warm-sm bg-paper-lowest font-sans ${className}`}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-paper-base border-b border-paper-border text-[11px] font-semibold uppercase tracking-wider text-ink-muted select-none">
            {columns.map((col) => (
              <th key={col.key} className={`py-3 px-4 ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-paper-border text-sm text-ink">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, rIdx) => (
              <tr key={`skel-${rIdx}`} className="animate-pulse">
                {columns.map((col, cIdx) => (
                  <td key={`skel-c-${cIdx}`} className="py-3.5 px-4">
                    <div className="h-4 bg-paper-high rounded-sm w-3/4" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-8 px-4 text-center text-ink-muted text-xs italic">
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick && onRowClick(row)}
                className={`transition-colors duration-150 ${
                  onRowClick ? 'cursor-pointer hover:bg-paper-high' : 'hover:bg-paper-base/60'
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`py-3 px-4 ${col.className || ''}`}>
                    {col.render ? col.render(row) : (row as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

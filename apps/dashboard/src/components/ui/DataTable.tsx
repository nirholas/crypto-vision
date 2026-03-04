'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render: (row: T, index: number) => ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  loading?: boolean;
  emptyMessage?: string;
  stickyHeader?: boolean;
  compact?: boolean;
  striped?: boolean;
  hoverable?: boolean;
  className?: string;
  onRowClick?: (row: T, index: number) => void;
}

/* ─── Skeleton Row ───────────────────────────────────────────────────── */

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-[var(--surface-border)]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="skeleton h-4 rounded" style={{ width: `${40 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onSort,
  sortKey,
  sortDirection,
  loading = false,
  emptyMessage = 'No data available',
  stickyHeader = true,
  compact = false,
  striped = false,
  hoverable = true,
  className = '',
  onRowClick,
}: DataTableProps<T>) {
  const handleSort = useCallback(
    (key: string) => {
      if (!onSort) return;
      const newDirection =
        sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
      onSort(key, newDirection);
    },
    [onSort, sortKey, sortDirection],
  );

  const cellPadding = compact ? 'px-3 py-2' : 'px-3 py-3';

  return (
    <div className={`overflow-x-auto rounded-xl border border-[var(--surface-border)] ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr
            className={`
              bg-[var(--surface)] text-[var(--text-muted)] text-xs uppercase tracking-wider
              ${stickyHeader ? 'sticky top-0 z-10' : ''}
            `}
          >
            {columns.map((col) => {
              const isSorted = sortKey === col.key;
              const alignClass =
                col.align === 'right'
                  ? 'text-right'
                  : col.align === 'center'
                    ? 'text-center'
                    : 'text-left';

              return (
                <th
                  key={col.key}
                  className={`
                    ${cellPadding} font-semibold ${alignClass}
                    ${col.sortable ? 'cursor-pointer select-none hover:text-[var(--text-secondary)] transition-colors' : ''}
                  `}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  aria-sort={
                    isSorted
                      ? sortDirection === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <span className="inline-flex flex-col -space-y-1">
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <ChevronUp size={12} className="text-[var(--primary)]" />
                          ) : (
                            <ChevronDown size={12} className="text-[var(--primary)]" />
                          )
                        ) : (
                          <ChevronsUpDown size={12} className="opacity-40" />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <SkeletonRow key={`skel-${i}`} cols={columns.length} />
            ))
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-[var(--text-muted)] text-sm"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => {
              const alignClasses = columns.map((col) =>
                col.align === 'right'
                  ? 'text-right'
                  : col.align === 'center'
                    ? 'text-center'
                    : 'text-left',
              );

              return (
                <tr
                  key={keyExtractor(row, rowIdx)}
                  className={`
                    border-b border-[var(--surface-border)] transition-colors
                    ${hoverable ? 'row-highlight cursor-pointer' : ''}
                    ${striped && rowIdx % 2 === 1 ? 'bg-[var(--surface)]/30' : ''}
                  `}
                  onClick={onRowClick ? () => onRowClick(row, rowIdx) : undefined}
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={col.key}
                      className={`${cellPadding} ${alignClasses[colIdx]} text-[var(--text-primary)]`}
                    >
                      {col.render(row, rowIdx)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;

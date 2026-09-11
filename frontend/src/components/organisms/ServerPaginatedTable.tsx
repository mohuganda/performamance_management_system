import type { LucideIcon } from 'lucide-react'
import { Database } from 'lucide-react'
import type { PaginatedResponse } from '@/types/pagination'
import { TablePagination } from '@/components/molecules/TablePagination'
import { cn } from '@/utils/cn'

export interface FancyTableColumn {
  key: string
  label: string
  icon?: LucideIcon
  iconClassName?: string
  className?: string
  align?: 'left' | 'center' | 'right'
}

interface ServerPaginatedTableProps<T> {
  title?: string
  description?: string
  columns: FancyTableColumn[]
  rows: T[]
  pagination: Pick<PaginatedResponse<T>, 'total' | 'page' | 'per_page' | 'total_pages'>
  onPageChange: (page: number) => void
  renderRow: (row: T, index: number, rowNumber: number) => React.ReactNode
  rowKey: (row: T) => string | number
  emptyMessage?: string
  className?: string
  /** Toolbar slot (filters, export, etc.) rendered below header */
  toolbar?: React.ReactNode
  /** Show total record counter in header (default true) */
  showRecordCounter?: boolean
  /** Show # column with row numbers (default true) */
  showRowNumbers?: boolean
  rowNumberLabel?: string
}

export function ServerPaginatedTable<T>({
  title,
  description,
  columns,
  rows,
  pagination,
  onPageChange,
  renderRow,
  rowKey,
  emptyMessage = 'No records found.',
  className,
  toolbar,
  showRecordCounter = true,
  showRowNumbers = true,
  rowNumberLabel = '#',
}: ServerPaginatedTableProps<T>) {
  const { page, total_pages, total, per_page } = pagination
  const start = total === 0 ? 0 : (page - 1) * per_page + 1
  const end = Math.min(page * per_page, total)
  const pageRows = rows.length
  const displayColumns = showRowNumbers
    ? [{ key: '_rownum', label: rowNumberLabel, align: 'center' as const, className: 'w-12' }, ...columns]
    : columns

  return (
    <div
      className={cn(
        'overflow-hidden rounded-sm border border-ui-border bg-ui-surface shadow-sm',
        className,
      )}
    >
      {(title || showRecordCounter) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ui-border bg-ui-subtle/60 px-4 py-3">
          <div>
            {title ? (
              <h3 className="text-sm font-bold uppercase tracking-wide text-ui-text">{title}</h3>
            ) : null}
            {description ? <p className="mt-0.5 text-xs text-ui-muted">{description}</p> : null}
          </div>
          {showRecordCounter ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-ui-border bg-ui-surface px-3 py-1.5 text-xs font-medium text-ui-muted shadow-sm">
              <Database className="h-3.5 w-3.5 text-ui-text" />
              <span>
                <strong className="text-ui-text">{total.toLocaleString()}</strong> total
                {pageRows > 0 ? (
                  <>
                    {' '}
                    · showing <strong className="text-ui-text">{start.toLocaleString()}</strong>–
                    <strong className="text-ui-text">{end.toLocaleString()}</strong>
                  </>
                ) : null}
              </span>
            </div>
          ) : null}
        </div>
      )}

      {toolbar ? (
        <div className="border-b border-ui-border bg-ui-surface px-4 py-3">{toolbar}</div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-ui-text">
          <thead>
            <tr className="border-b border-ui-border bg-ui-subtle text-[11px] font-semibold uppercase tracking-wider text-ui-muted">
              {displayColumns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'whitespace-nowrap px-4 py-3',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.className,
                  )}
                >
                  {col.icon ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={cn(
                          'inline-flex rounded p-1',
                          col.iconClassName ?? 'bg-moh-green/10 text-moh-green',
                        )}
                      >
                        <col.icon className="h-3 w-3" />
                      </span>
                      {col.label}
                    </span>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ui-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={displayColumns.length} className="px-4 py-12 text-center">
                  <p className="text-sm text-ui-muted">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const rowNumber = start + index
                return (
                <tr
                  key={rowKey(row)}
                  className={cn(
                    'transition-colors hover:bg-ui-subtle/80',
                    index % 2 === 1 && 'bg-ui-subtle/40',
                  )}
                >
                  {showRowNumbers ? (
                    <td className="px-4 py-3 text-center text-xs font-medium tabular-nums text-ui-muted">
                      {rowNumber}
                    </td>
                  ) : null}
                  {renderRow(row, index, rowNumber)}
                </tr>
              )})
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={page}
        totalPages={total_pages}
        onPageChange={onPageChange}
        summary={
          total === 0
            ? 'No records'
            : `Page ${page} of ${total_pages} · ${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}`
        }
      />
    </div>
  )
}

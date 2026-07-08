import { Button, Typography } from '@material-tailwind/react'
import { ChevronLeft, ChevronRight, Database } from 'lucide-react'
import type { PaginatedResponse } from '@/types/pagination'
import { mt } from '@/utils/mt'
import { cn } from '@/utils/cn'

export interface FancyTableColumn {
  key: string
  label: string
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
  renderRow: (row: T, index: number) => React.ReactNode
  rowKey: (row: T) => string | number
  emptyMessage?: string
  className?: string
  /** Show total record counter in header and footer (default true) */
  showRecordCounter?: boolean
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
  showRecordCounter = true,
}: ServerPaginatedTableProps<T>) {
  const { page, total_pages, total, per_page } = pagination
  const start = total === 0 ? 0 : (page - 1) * per_page + 1
  const end = Math.min(page * per_page, total)
  const pageRows = rows.length

  return (
    <div
      className={cn(
        'overflow-hidden rounded-sm border border-moh-green/15 bg-white shadow-sm',
        className,
      )}
    >
      {(title || showRecordCounter) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-moh-green/10 bg-gradient-to-r from-moh-background via-white to-moh-background/40 px-4 py-3">
          <div>
            {title ? (
              <h3 className="text-sm font-bold uppercase tracking-wide text-moh-green">{title}</h3>
            ) : null}
            {description ? <p className="mt-0.5 text-xs text-gray-500">{description}</p> : null}
          </div>
          {showRecordCounter ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-moh-green/20 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm">
              <Database className="h-3.5 w-3.5 text-moh-green" />
              <span>
                <strong className="text-moh-green">{total.toLocaleString()}</strong> total
                {pageRows > 0 ? (
                  <>
                    {' '}
                    · showing <strong>{start.toLocaleString()}</strong>–<strong>{end.toLocaleString()}</strong>
                  </>
                ) : null}
              </span>
            </div>
          ) : null}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-moh-green/10 bg-moh-green/[0.06] text-[11px] font-semibold uppercase tracking-wider text-gray-600">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'whitespace-nowrap px-4 py-3',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.className,
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <p className="text-sm text-gray-400">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={rowKey(row)}
                  className={cn(
                    'transition-colors hover:bg-moh-green/[0.04]',
                    index % 2 === 1 && 'bg-gray-50/60',
                  )}
                >
                  {renderRow(row, index)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/50 px-4 py-3">
        <Typography {...mt} className="text-xs text-gray-600">
          {total === 0 ? (
            'No records'
          ) : (
            <>
              Page <strong>{page}</strong> of <strong>{total_pages}</strong>
              <span className="mx-2 text-gray-300">|</span>
              {start}–{end} of {total.toLocaleString()} record{total === 1 ? '' : 's'}
            </>
          )}
        </Typography>
        <div className="flex items-center gap-2">
          <Button
            {...mt}
            size="sm"
            variant="outlined"
            className="flex items-center gap-1 rounded-sm border-moh-green/25 normal-case text-moh-green hover:bg-moh-green/5"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            {...mt}
            size="sm"
            variant="outlined"
            className="flex items-center gap-1 rounded-sm border-moh-green/25 normal-case text-moh-green hover:bg-moh-green/5"
            disabled={page >= total_pages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

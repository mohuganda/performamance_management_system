import { Card } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { TrafficScore } from '@/components/atoms/TrafficScore'
import { TablePagination } from '@/components/molecules/TablePagination'
import { useClientPagination } from '@/hooks/useClientPagination'
import { isScoreColumn, statusTone } from '@/utils/trafficSignal'
import { Database } from 'lucide-react'
import { cn } from '@/utils/cn'

interface DataTableProps {
  title: string
  description?: string
  columns: string[]
  rows: Array<Record<string, string | number>>
  className?: string
  showRowNumbers?: boolean
  emptyMessage?: string
  highlighted?: boolean
  /** When set, paginate rows client-side with this page size */
  perPage?: number
}

export function DataTable({
  title,
  description,
  columns,
  rows,
  className,
  showRowNumbers = false,
  emptyMessage = 'No records found.',
  highlighted = false,
  perPage,
}: DataTableProps) {
  const { pageItems, pagination, setPage } = useClientPagination(
    rows,
    perPage ?? (rows.length || 1),
    [rows.length, perPage],
  )
  const displayRows = perPage ? pageItems : rows
  const total = perPage ? pagination.total : rows.length
  const displayColumns = showRowNumbers ? ['#', ...columns] : columns
  const rowOffset = perPage ? (pagination.page - 1) * pagination.per_page : 0

  return (
    <Card
      className={cn(
        'overflow-hidden border p-0 shadow-sm',
        highlighted ? 'border-moh-green ring-2 ring-moh-green/20' : 'border-moh-green/15',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ui-border bg-ui-subtle/60 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-ui-text">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-ui-muted">{description}</p> : null}
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-ui-border bg-ui-surface px-3 py-1.5 text-xs font-medium text-ui-muted shadow-sm">
          <Database className="h-3.5 w-3.5 text-ui-text" />
          <span>
            <strong className="text-ui-text">{total.toLocaleString()}</strong> record
            {total === 1 ? '' : 's'}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-ui-text">
          <thead>
            <tr className="border-b border-ui-border bg-ui-subtle text-[11px] font-semibold uppercase tracking-wider text-ui-muted">
              {displayColumns.map((column) => (
                <th
                  key={column}
                  className={cn('whitespace-nowrap px-4 py-3', column === '#' && 'w-12 text-center')}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ui-border">
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={displayColumns.length} className="px-4 py-12 text-center text-sm text-ui-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              displayRows.map((row, index) => (
                <tr
                  key={index}
                  className={cn(
                    'transition-colors hover:bg-ui-subtle/80',
                    index % 2 === 1 && 'bg-ui-subtle/40',
                  )}
                >
                  {showRowNumbers ? (
                    <td className="px-4 py-3 text-center text-xs font-medium tabular-nums text-ui-muted">
                      {rowOffset + index + 1}
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td key={column} className="px-4 py-3 align-top">
                      {column === 'Status' && typeof row[column] === 'string' ? (
                        <Badge label={String(row[column])} tone={statusTone(String(row[column]))} />
                      ) : isScoreColumn(column) ? (
                        <TrafficScore value={row[column] ?? '—'} />
                      ) : (
                        row[column]
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {perPage ? (
        <TablePagination
          page={pagination.page}
          totalPages={pagination.total_pages}
          onPageChange={setPage}
          summary={
            total === 0
              ? 'No records'
              : `${rowOffset + 1}–${Math.min(rowOffset + perPage, total)} of ${total.toLocaleString()}`
          }
        />
      ) : null}
    </Card>
  )
}

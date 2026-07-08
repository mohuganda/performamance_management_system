import { Card } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { TablePagination } from '@/components/molecules/TablePagination'
import { useClientPagination } from '@/hooks/useClientPagination'
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
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-moh-green/10 bg-gradient-to-r from-moh-background via-white to-moh-background/40 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-moh-green">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-gray-500">{description}</p> : null}
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-moh-green/20 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm">
          <Database className="h-3.5 w-3.5 text-moh-green" />
          <span>
            <strong className="text-moh-green">{total.toLocaleString()}</strong> record
            {total === 1 ? '' : 's'}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-moh-green/10 bg-moh-green/[0.06] text-[11px] font-semibold uppercase tracking-wider text-gray-600">
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
          <tbody className="divide-y divide-gray-100">
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={displayColumns.length} className="px-4 py-12 text-center text-sm text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              displayRows.map((row, index) => (
                <tr
                  key={index}
                  className={cn(
                    'transition-colors hover:bg-moh-green/[0.04]',
                    index % 2 === 1 && 'bg-gray-50/60',
                  )}
                >
                  {showRowNumbers ? (
                    <td className="px-4 py-3 text-center text-xs font-medium tabular-nums text-gray-500">
                      {rowOffset + index + 1}
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td key={column} className="px-4 py-3 align-top">
                      {column === 'Status' && typeof row[column] === 'string' ? (
                        <Badge
                          label={String(row[column])}
                          tone={
                            String(row[column]).toLowerCase().includes('off')
                              ? 'error'
                              : String(row[column]).toLowerCase().includes('risk')
                                ? 'warning'
                                : 'success'
                          }
                        />
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

import { Card } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Database } from 'lucide-react'
import { cn } from '@/utils/cn'

interface DataTableProps {
  title: string
  description?: string
  columns: string[]
  rows: Array<Record<string, string | number>>
  className?: string
}

export function DataTable({ title, description, columns, rows, className }: DataTableProps) {
  return (
    <Card className={cn('overflow-hidden border border-moh-green/15 p-0 shadow-sm', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-moh-green/10 bg-gradient-to-r from-moh-background via-white to-moh-background/40 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-moh-green">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-gray-500">{description}</p> : null}
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-moh-green/20 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm">
          <Database className="h-3.5 w-3.5 text-moh-green" />
          <span>
            <strong className="text-moh-green">{rows.length.toLocaleString()}</strong> record
            {rows.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-moh-green/10 bg-moh-green/[0.06] text-[11px] font-semibold uppercase tracking-wider text-gray-600">
              {columns.map((column) => (
                <th key={column} className="whitespace-nowrap px-4 py-3">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, index) => (
              <tr
                key={index}
                className={cn(
                  'transition-colors hover:bg-moh-green/[0.04]',
                  index % 2 === 1 && 'bg-gray-50/60',
                )}
              >
                {columns.map((column) => (
                  <td key={column} className="px-4 py-3 align-top">
                    {column === 'Status' && typeof row[column] === 'string' ? (
                      <Badge
                        label={String(row[column])}
                        tone={
                          String(row[column]).includes('Off')
                            ? 'error'
                            : String(row[column]).includes('Risk')
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
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

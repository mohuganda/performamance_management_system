import { useMemo, useState, type ReactNode } from 'react'
import { Button, Input } from '@material-tailwind/react'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { Select, Option } from '@/components/molecules/MtSelect'
import { exportTableExcel, exportTablePdf } from '@/utils/tableExport'
import { cn } from '@/utils/cn'
import { mt } from '@/utils/mt'
import { notifyApiError, toast } from '@/features/toast'

export type RequestHistoryColumn<T> = {
  key: string
  label: string
  className?: string
  render: (row: T) => ReactNode
  /** Plain-text value used for Excel/PDF export. Falls back to getSearchText slices if omitted. */
  exportValue?: (row: T) => string
}

type RequestHistoryPanelProps<T extends Record<string, unknown>> = {
  title?: string
  rows: T[]
  columns: RequestHistoryColumn<T>[]
  getStatus: (row: T) => string
  getSearchText: (row: T) => string
  statusOptions?: string[]
  searchPlaceholder?: string
  emptyLabel?: string
  className?: string
  exportFilename?: string
}

function uniqueStatuses(rows: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const status of rows) {
    const key = status.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(status)
  }
  return out.sort((a, b) => a.localeCompare(b))
}

function cellExportValue<T extends Record<string, unknown>>(
  column: RequestHistoryColumn<T>,
  row: T,
  getStatus: (row: T) => string,
): string {
  if (column.exportValue) return column.exportValue(row)
  if (column.key === 'status') return getStatus(row).replace(/_/g, ' ')
  return ''
}

export function RequestHistoryPanel<T extends Record<string, unknown>>({
  title = 'My requests',
  rows,
  columns,
  getStatus,
  getSearchText,
  statusOptions,
  searchPlaceholder = 'Search requests…',
  emptyLabel = 'No requests found.',
  className,
  exportFilename,
}: RequestHistoryPanelProps<T>) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)

  const availableStatuses = useMemo(() => {
    if (statusOptions?.length) return statusOptions
    return uniqueStatuses(rows.map((row) => getStatus(row)))
  }, [rows, statusOptions, getStatus])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      const status = getStatus(row)
      if (statusFilter !== 'all' && status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false
      }
      if (!q) return true
      return getSearchText(row).toLowerCase().includes(q)
    })
  }, [rows, search, statusFilter, getStatus, getSearchText])

  const exportRows = useMemo(
    () =>
      filtered.map((row) =>
        columns.map((column) => cellExportValue(column, row, getStatus)),
      ),
    [filtered, columns, getStatus],
  )

  const handleExcel = () => {
    if (filtered.length === 0) return
    setExporting('excel')
    try {
      exportTableExcel({
        title,
        headers: columns.map((column) => column.label),
        rows: exportRows,
        filename: exportFilename,
      })
      toast.success('Excel export downloaded.')
    } catch (error) {
      notifyApiError(error, 'Could not export Excel')
    } finally {
      setExporting(null)
    }
  }

  const handlePdf = async () => {
    if (filtered.length === 0) return
    setExporting('pdf')
    try {
      await exportTablePdf({
        title,
        headers: columns.map((column) => column.label),
        rows: exportRows,
        filename: exportFilename,
      })
      toast.success('PDF export downloaded.')
    } catch (error) {
      notifyApiError(error, 'Could not export PDF')
    } finally {
      setExporting(null)
    }
  }

  return (
    <section
      className={cn('rounded-sm border border-moh-green/15 bg-ui-surface p-4 shadow-sm', className)}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-moh-green">{title}</h2>
          <p className="mt-1 text-xs text-ui-muted">
            Showing {filtered.length} of {rows.length} request{rows.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            {...mt}
            size="sm"
            variant="outlined"
            className="flex items-center gap-2 rounded-sm border-emerald-300 normal-case text-emerald-800 hover:bg-emerald-50"
            onClick={handleExcel}
            disabled={!!exporting || filtered.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4" />
            {exporting === 'excel' ? 'Exporting…' : 'Export Excel'}
          </Button>
          <Button
            {...mt}
            size="sm"
            className="flex items-center gap-2 rounded-sm bg-moh-green normal-case shadow-none hover:bg-moh-green/90"
            onClick={() => void handlePdf()}
            disabled={!!exporting || filtered.length === 0}
          >
            <FileText className="h-4 w-4" />
            {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <Input
            {...mt}
            type="search"
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="rounded-sm"
            color="gray"
            crossOrigin=""
          />
        </div>
        <div className="w-full min-w-[160px] sm:w-48">
          <Select
            {...mt}
            label="Status"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v ?? 'all')}
            className="rounded-sm"
          >
            <Option value="all">All statuses</Option>
            {availableStatuses.map((status) => (
              <Option key={status} value={status}>
                {status.replace(/_/g, ' ')}
              </Option>
            ))}
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-ui-border text-[11px] font-semibold uppercase tracking-wide text-ui-muted">
              <th className="w-12 py-2.5 pr-3 text-center">#</th>
              {columns.map((column) => (
                <th key={column.key} className={cn('py-2.5 pr-4', column.className)}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="py-8 text-center text-sm text-ui-muted">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              filtered.map((row, index) => {
                return (
                  <tr
                    key={String(row.id ?? row.ID ?? index)}
                    className="border-b border-ui-border/70 last:border-0"
                  >
                    <td className="py-3 pr-3 text-center text-xs font-medium tabular-nums text-ui-muted">
                      {index + 1}
                    </td>
                    {columns.map((column) => (
                      <td key={column.key} className={cn('py-3 pr-4 align-top', column.className)}>
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

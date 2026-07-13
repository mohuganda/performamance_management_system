import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Chip, Input, Typography } from '@material-tailwind/react'
import { Select, Option } from '@/components/molecules/MtSelect'
import {
  BarChart3,
  BadgeCheck,
  CalendarRange,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  SlidersHorizontal,
  Target,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import { performanceService } from '@/api/services/mobile'
import { PageHeader } from '@/components/organisms/PageHeader'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { QueryState } from '@/components/organisms/QueryState'
import { ServerPaginatedTable } from '@/components/organisms/ServerPaginatedTable'
import { useAdminPageSize } from '@/hooks/useAdminPageSize'
import { useClientPagination } from '@/hooks/useClientPagination'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { mt } from '@/utils/mt'
import {
  exportPerformanceReportExcel,
  exportPerformanceReportPdf,
  type PerformanceStatusReport,
  type PerformanceStatusRow,
} from '@/utils/performanceReportExport'
import { cn } from '@/utils/cn'

function normalizeStatusReport(data: unknown): PerformanceStatusReport | null {
  if (!data || typeof data !== 'object') return null
  const report = data as PerformanceStatusReport
  if (!Array.isArray(report.rows)) return null
  return report
}

const PERIODS = [
  { id: 'q1', label: 'Q1', accent: 'bg-sky-100 text-sky-700', icon: CalendarRange },
  { id: 'midterm', label: 'Midterm', accent: 'bg-violet-100 text-violet-700', icon: Target },
  { id: 'q3', label: 'Q3', accent: 'bg-amber-100 text-amber-800', icon: CalendarRange },
  { id: 'endterm', label: 'Endterm', accent: 'bg-emerald-100 text-emerald-800', icon: BadgeCheck },
] as const

const PPA_FILTER_OPTIONS = [
  { value: '', label: 'All PPA statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const SCORE_FILTER_OPTIONS = [
  { value: '', label: 'All scores' },
  { value: 'scored', label: 'Has overall score' },
  { value: 'unscored', label: 'No overall score' },
]

function ppaChipColor(status: string) {
  if (status === 'approved') return 'green'
  if (status === 'rejected') return 'red'
  if (status === 'submitted') return 'amber'
  return 'gray'
}

function periodStatusClass(submission?: string, approval?: string) {
  if (approval === 'approved') return 'bg-moh-green/10 text-moh-green'
  if (approval === 'rejected') return 'bg-red-50 text-red-700'
  if (submission === 'submitted' || approval === 'pending_approval') return 'bg-amber-50 text-amber-800'
  return 'bg-gray-100 text-gray-500'
}

function formatStatus(submission?: string, approval?: string) {
  if (!submission || submission === 'not_submitted') return 'Not submitted'
  if (approval === 'approved') return 'Approved'
  if (approval === 'rejected') return 'Rejected'
  if (submission === 'submitted' || approval === 'pending_approval') return 'Submitted'
  return String(submission).replace(/_/g, ' ')
}

function ScoreCell({ row, reportType }: { row: PerformanceStatusRow; reportType: string }) {
  const period = row.periods?.find((p) => p.report_type === reportType)
  return (
    <div className="space-y-1">
      <span
        className={cn(
          'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
          periodStatusClass(period?.submission_status, period?.approval_status),
        )}
      >
        {formatStatus(period?.submission_status, period?.approval_status)}
      </span>
      {period?.has_entries || (period && period.normalized_score > 0) ? (
        <div className="text-xs leading-tight">
          <div className="font-semibold text-ui-text">{period.normalized_score}%</div>
          <div className="text-gray-500">raw {period.raw_weighted_score}</div>
        </div>
      ) : (
        <div className="text-xs text-gray-400">—</div>
      )}
    </div>
  )
}

function uniqueSorted(values: Array<string | undefined>) {
  return [...new Set(values.map((v) => v?.trim()).filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b),
  )
}

export function PerformanceReportsPage() {
  const pageSize = useAdminPageSize()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 250)
  const [facilityFilter, setFacilityFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [ppaFilter, setPpaFilter] = useState('')
  const [scoreFilter, setScoreFilter] = useState('')
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)

  const reportQuery = useQuery({
    queryKey: ['performance', 'status-report'],
    queryFn: () => performanceService.statusReport() as Promise<PerformanceStatusReport>,
  })

  const report = normalizeStatusReport(reportQuery.data)
  const allRows = report?.rows ?? []

  const facilityOptions = useMemo(() => uniqueSorted(allRows.map((r) => r.facility_name)), [allRows])
  const departmentOptions = useMemo(
    () => uniqueSorted(allRows.map((r) => r.department_name)),
    [allRows],
  )

  const filteredRows = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase()
    return allRows.filter((row) => {
      if (needle) {
        const haystack = `${row.staff_name} ${row.facility_name ?? ''} ${row.department_name ?? ''} ${row.job_title ?? ''}`.toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      if (facilityFilter && row.facility_name !== facilityFilter) return false
      if (departmentFilter && row.department_name !== departmentFilter) return false
      if (ppaFilter && row.ppa_status !== ppaFilter) return false
      if (scoreFilter === 'scored' && !(row.overall_normalized_score > 0)) return false
      if (scoreFilter === 'unscored' && row.overall_normalized_score > 0) return false
      return true
    })
  }, [allRows, debouncedSearch, facilityFilter, departmentFilter, ppaFilter, scoreFilter])

  const { pageItems, pagination, setPage } = useClientPagination(filteredRows, pageSize, [
    debouncedSearch,
    facilityFilter,
    departmentFilter,
    ppaFilter,
    scoreFilter,
  ])

  const totals = report?.totals ?? {}
  const hasActiveFilters =
    !!debouncedSearch.trim() ||
    !!facilityFilter ||
    !!departmentFilter ||
    !!ppaFilter ||
    !!scoreFilter

  const clearFilters = () => {
    setSearch('')
    setFacilityFilter('')
    setDepartmentFilter('')
    setPpaFilter('')
    setScoreFilter('')
  }

  const exportPayload = report ? { ...report, rows: filteredRows } : null

  const handleExcel = () => {
    if (!exportPayload) return
    setExporting('excel')
    try {
      exportPerformanceReportExcel(exportPayload)
    } finally {
      setExporting(null)
    }
  }

  const handlePdf = async () => {
    if (!exportPayload) return
    setExporting('pdf')
    try {
      await exportPerformanceReportPdf(exportPayload)
    } finally {
      setExporting(null)
    }
  }

  const columns = [
    { key: 'staff', label: 'Staff' },
    { key: 'ppa', label: 'PPA' },
    ...PERIODS.map((p) => ({ key: p.id, label: p.label })),
    { key: 'overall', label: 'Overall' },
  ]

  return (
    <div className="pb-10">
      <PageHeader
        title="Reports"
        subtitle="PPA submission, quarterly reporting status, and Overall Performance Rating scores"
      />

      <QueryState
        isLoading={reportQuery.isLoading}
        isError={reportQuery.isError || (!reportQuery.isLoading && reportQuery.isFetched && !report)}
        error={
          reportQuery.error ??
          (!report ? new Error('The server returned an empty report. Restart the API or try again.') : null)
        }
        label="performance status report"
        variant="dashboard"
        onRetry={() => reportQuery.refetch()}
      >
        {report ? (
          <div className="space-y-6">
            <Card {...mt} className="rounded-sm border border-ui-border bg-ui-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-gradient-to-br from-sky-100 to-indigo-100 text-indigo-700">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <div>
                    <Typography {...mt} className="text-sm font-bold uppercase tracking-wide text-moh-green">
                      {report.financial_year}
                    </Typography>
                    <p className="mt-1 text-sm text-gray-600">{report.scope_note}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      Scores follow Overall Performance Rating: raw = Σ((actual÷target)×weight). Values are
                      normalised to 100% when weights do not total 100.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    {...mt}
                    size="sm"
                    variant="outlined"
                    className="flex items-center gap-2 rounded-sm border-emerald-300 normal-case text-emerald-800 hover:bg-emerald-50"
                    onClick={handleExcel}
                    disabled={!!exporting || filteredRows.length === 0}
                  >
                    <span className="inline-flex rounded bg-emerald-100 p-1 text-emerald-700">
                      <FileSpreadsheet className="h-4 w-4" />
                    </span>
                    {exporting === 'excel' ? 'Exporting…' : 'Export Excel'}
                  </Button>
                  <Button
                    {...mt}
                    size="sm"
                    className="flex items-center gap-2 rounded-sm bg-indigo-700 normal-case hover:bg-indigo-800"
                    onClick={handlePdf}
                    disabled={!!exporting || filteredRows.length === 0}
                  >
                    <span className="inline-flex rounded bg-white/20 p-1">
                      <FileText className="h-4 w-4" />
                    </span>
                    {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  title="Staff in scope"
                  value={totals.staff ?? allRows.length}
                  icon={Users}
                  accent="blue"
                />
                <MetricCard
                  title="PPA submitted"
                  value={totals.ppa_submitted ?? 0}
                  icon={FileCheck}
                  accent="amber"
                />
                <MetricCard
                  title="PPA approved"
                  value={totals.ppa_approved ?? 0}
                  icon={BadgeCheck}
                  accent="green"
                />
                <MetricCard
                  title="Filtered rows"
                  value={filteredRows.length}
                  icon={SlidersHorizontal}
                  accent="purple"
                />
              </div>
            </Card>

            <ServerPaginatedTable
              title="Staff performance status"
              description={`${filteredRows.length} staff after filters · ${pageSize} per page`}
              columns={columns}
              rows={pageItems}
              pagination={pagination}
              onPageChange={setPage}
              showRowNumbers={false}
              rowKey={(row) => row.staff_id}
              emptyMessage="No staff records match your filters."
              toolbar={
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <span className="inline-flex rounded bg-violet-100 p-1 text-violet-700">
                        <Filter className="h-3.5 w-3.5" />
                      </span>
                      Filters
                    </div>
                    {hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="inline-flex items-center gap-1 text-xs font-medium text-moh-green hover:underline"
                      >
                        <X className="h-3.5 w-3.5" />
                        Clear filters
                      </button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    <Input
                      {...mt}
                      label="Search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      crossOrigin=""
                    />
                    <Select
                      {...mt}
                      label="Facility"
                      value={facilityFilter}
                      onChange={(v) => setFacilityFilter((v as string) ?? '')}
                    >
                      <Option value="">All facilities</Option>
                      {facilityOptions.map((name) => (
                        <Option key={name} value={name}>
                          {name}
                        </Option>
                      ))}
                    </Select>
                    <Select
                      {...mt}
                      label="Department"
                      value={departmentFilter}
                      onChange={(v) => setDepartmentFilter((v as string) ?? '')}
                    >
                      <Option value="">All departments</Option>
                      {departmentOptions.map((name) => (
                        <Option key={name} value={name}>
                          {name}
                        </Option>
                      ))}
                    </Select>
                    <Select
                      {...mt}
                      label="PPA status"
                      value={ppaFilter}
                      onChange={(v) => setPpaFilter((v as string) ?? '')}
                    >
                      {PPA_FILTER_OPTIONS.map((opt) => (
                        <Option key={opt.value || 'all'} value={opt.value}>
                          {opt.label}
                        </Option>
                      ))}
                    </Select>
                    <Select
                      {...mt}
                      label="Overall score"
                      value={scoreFilter}
                      onChange={(v) => setScoreFilter((v as string) ?? '')}
                    >
                      {SCORE_FILTER_OPTIONS.map((opt) => (
                        <Option key={opt.value || 'all'} value={opt.value}>
                          {opt.label}
                        </Option>
                      ))}
                    </Select>
                  </div>
                </div>
              }
              renderRow={(row) => (
                <>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-ui-text">{row.staff_name}</div>
                    <div className="text-xs text-gray-500">
                      {[row.job_title, row.facility_name, row.department_name]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Chip
                      {...mt}
                      value={row.ppa_status.replace(/_/g, ' ')}
                      className="rounded-sm capitalize"
                      size="sm"
                      color={ppaChipColor(row.ppa_status)}
                    />
                    <div className="mt-1 text-xs text-gray-500">Weight {row.ppa_total_weight || 0}%</div>
                  </td>
                  {PERIODS.map((p) => (
                    <td key={p.id} className="px-4 py-3 align-top">
                      <ScoreCell row={row} reportType={p.id} />
                    </td>
                  ))}
                  <td className="px-4 py-3 align-top">
                    {row.overall_normalized_score > 0 ? (
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 inline-flex rounded bg-emerald-100 p-1 text-emerald-700">
                          <TrendingUp className="h-3.5 w-3.5" />
                        </span>
                        <div>
                          <div className="text-lg font-bold text-emerald-700">{row.overall_normalized_score}%</div>
                          <div className="text-xs text-gray-500">raw avg {row.overall_raw_score}</div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No scored periods</span>
                    )}
                  </td>
                </>
              )}
            />
          </div>
        ) : null}
      </QueryState>
    </div>
  )
}

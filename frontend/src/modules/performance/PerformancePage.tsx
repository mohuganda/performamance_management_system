import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Chip,
  Input,
  Progress,
  Tab,
  Tabs,
  TabsHeader,
  Textarea,
  Typography,
} from '@material-tailwind/react'
import { BarChart3, ClipboardList, LayoutDashboard, TrendingUp, UserCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { performanceService } from '@/api/services/mobile'
import {
  PerformanceAppraisalSections,
  useAppraisalFormState,
  type AppraisalBundle,
} from '@/components/performance/PerformanceAppraisalSections'
import { PageHeader } from '@/components/organisms/PageHeader'
import { ProcessGuide } from '@/components/organisms/ProcessGuide'
import { QueryState } from '@/components/organisms/QueryState'
import { FormStatusAlert, type FormStatusType } from '@/components/molecules/FormStatusAlert'
import { notifyApiError, toast } from '@/features/toast'
import { useAuthStore } from '@/stores/appStore'
import { mt } from '@/utils/mt'
import { cn } from '@/utils/cn'
import { asArray } from '@/utils/asArray'

const PERFORMANCE_STEPS = [
  {
    title: 'Review assigned KPIs',
    description:
      'KPIs come from your job (mandatory), your department pool, and individual HR assignments.',
    actor: 'Employee',
  },
  {
    title: 'Set your Performance Plan (PPA)',
    description: 'Confirm weights (total 100%) and targets, then submit for supervisor review.',
    actor: 'Employee',
  },
  {
    title: 'File quarterly reports',
    description:
      'Report actual values and narrative evidence against each KPI in your approved plan. Cumulative indicators use year-to-date totals that build through the year.',
    actor: 'Employee',
  },
]

const REPORT_PERIODS = [
  { id: 'q1', label: 'Q1', hint: 'Jul – Sep' },
  { id: 'midterm', label: 'Midterm', hint: 'Oct – Dec' },
  { id: 'q3', label: 'Q3', hint: 'Jan – Mar' },
  { id: 'endterm', label: 'End of year', hint: 'Apr – Jun' },
] as const

type QuarterMeta = {
  id: string
  label: string
  window: string
  status: string
  is_open: boolean
  open_at?: string
  close_at?: string
  days_remaining?: number
  reporting_window?: string
}

function formatWindowDate(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

type KpiItem = {
  id: number
  ppa_kpi_id?: number
  code: string
  name: string
  frequency: string
  computation_category: string
  subject_area_name: string
  source: string
  is_mandatory: boolean
  in_current_ppa: boolean
  weight_percentage?: number
  target_value?: number
  default_target?: number
  is_cumulative?: boolean
}

type SubjectGroup = {
  subject_area_id: number
  subject_area_name: string
  kpis: KpiItem[]
}

type PriorReport = {
  report_type: string
  label: string
  actual_value: number
}

type ReportKpi = {
  ppa_kpi_id: number
  code: string
  name: string
  frequency: string
  computation_category: string
  source: string
  weight_percentage: number
  target_value: number
  actual_value?: number
  narrative?: string
  progress_percent?: number
  is_cumulative?: boolean
  prior_reports?: PriorReport[]
  reporting_hint?: string
}

type ReportGroup = {
  subject_area_name: string
  kpis: ReportKpi[]
}

const SOURCE_LABEL: Record<string, string> = {
  job: 'Job (mandatory)',
  department: 'Department',
  individual: 'Individual',
}

const SUBJECT_COLORS: Record<number, string> = {
  1: 'border-l-blue-600',
  2: 'border-l-purple-600',
  3: 'border-l-amber-600',
  4: 'border-l-slate-700',
  7: 'border-l-emerald-600',
}

function cumulativeChip() {
  return (
    <Chip
      {...mt}
      size="sm"
      variant="ghost"
      value="Cumulative · YTD"
      icon={
        <span className="mr-0.5 inline-flex">
          <TrendingUp className="h-3 w-3" />
        </span>
      }
      className="rounded-sm normal-case bg-blue-50 text-blue-800"
    />
  )
}

function sourceChip(source: string, mandatory: boolean) {
  const label = SOURCE_LABEL[source] ?? source
  return (
    <Chip
      {...mt}
      size="sm"
      variant="ghost"
      value={mandatory ? `${label} · required` : label}
      className={cn(
        'rounded-sm normal-case',
        mandatory ? 'bg-uganda-yellow/20 text-uganda-black' : 'bg-ui-subtle text-ui-muted',
      )}
    />
  )
}

function extractErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const resp = (error as { response?: { data?: { message?: string } } }).response
    if (resp?.data?.message) return resp.data.message
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong'
}

function ReportPeriodPicker({
  reportType,
  quarterWindows,
  onSelect,
}: {
  reportType: string
  quarterWindows: QuarterMeta[]
  onSelect: (id: string) => void
}) {
  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto lg:min-w-[420px]">
      {REPORT_PERIODS.map((q) => {
        const meta = quarterWindows.find((w) => w.id === q.id)
        const isOpen = meta?.is_open !== false
        const selected = reportType === q.id
        return (
          <button
            key={q.id}
            type="button"
            disabled={!isOpen && !selected}
            onClick={() => onSelect(q.id)}
            className={cn(
              'rounded-sm border px-3 py-2.5 text-left transition',
              selected
                ? 'border-moh-green bg-moh-green text-white shadow-sm'
                : 'border-ui-border bg-white hover:border-moh-green/40 hover:bg-moh-green/5',
              !isOpen && !selected ? 'cursor-not-allowed opacity-50' : '',
            )}
          >
            <span className="block text-sm font-semibold">{q.label}</span>
            <span className={cn('mt-0.5 block text-xs', selected ? 'text-white/90' : 'text-ui-muted')}>
              {meta?.status === 'open'
                ? `Open · ${meta.days_remaining ?? 0}d left`
                : meta?.status === 'upcoming'
                  ? 'Upcoming'
                  : meta?.status === 'closed'
                    ? 'Closed'
                    : q.hint}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function KpiPlanningRow({
  kpi,
  planWeights,
  planTargets,
  onWeightChange,
  onTargetChange,
}: {
  kpi: KpiItem
  planWeights: Record<number, string>
  planTargets: Record<number, string>
  onWeightChange: (id: number, value: string) => void
  onTargetChange: (id: number, value: string) => void
}) {
  return (
    <div className="overflow-hidden rounded-sm border border-ui-border bg-white p-4 shadow-sm">
      <div className="space-y-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug text-ui-text">{kpi.name}</p>
          <p className="mt-1 text-xs text-ui-muted">
            {kpi.code} · {kpi.frequency} · {kpi.computation_category}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sourceChip(kpi.source, kpi.is_mandatory)}
            {kpi.is_cumulative ? cumulativeChip() : null}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 border-t border-ui-border/60 pt-4 sm:grid-cols-2 sm:max-w-md">
          <Input
            {...mt}
            type="number"
            label="Weight %"
            className="!min-w-0"
            value={
              planWeights[kpi.id] ?? (kpi.in_current_ppa ? String(kpi.weight_percentage) : '')
            }
            onChange={(e) => onWeightChange(kpi.id, e.target.value)}
            containerProps={{ className: 'min-w-0 w-full' }}
          />
          <Input
            {...mt}
            type="number"
            label="Target"
            className="!min-w-0"
            value={
              planTargets[kpi.id] ??
              (kpi.target_value != null
                ? String(kpi.target_value)
                : kpi.default_target != null
                  ? String(kpi.default_target)
                  : '100')
            }
            onChange={(e) => onTargetChange(kpi.id, e.target.value)}
            containerProps={{ className: 'min-w-0 w-full' }}
          />
        </div>
      </div>
    </div>
  )
}

function formatReportActual(value: number | undefined): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return ''
  }
  return String(value)
}

function KpiReportRow({
  kpi,
  reportDraft,
  onDraftChange,
}: {
  kpi: ReportKpi
  reportDraft: Record<number, { actual: string; narrative: string }>
  onDraftChange: (ppaKpiId: number, patch: { actual?: string; narrative?: string }) => void
}) {
  const draftActual = reportDraft[kpi.ppa_kpi_id]?.actual
  const apiActual = formatReportActual(kpi.actual_value)
  const actualValue =
    draftActual != null && draftActual !== '' ? draftActual : apiActual
  const narrativeValue = reportDraft[kpi.ppa_kpi_id]?.narrative ?? kpi.narrative ?? ''
  const isCumulative = kpi.is_cumulative === true
  const priorReports = kpi.prior_reports ?? []
  const lastPrior =
    priorReports.length > 0 ? priorReports[priorReports.length - 1].actual_value : undefined
  const actualNum = Number(actualValue || 0)
  const belowPrior =
    isCumulative && lastPrior != null && actualValue !== '' && actualNum < lastPrior
  const progress =
    kpi.progress_percent ??
    (kpi.target_value > 0 ? (actualNum / kpi.target_value) * 100 : 0)
  const progressClamped = Math.min(Math.max(progress, 0), 100)
  const unitSuffix = kpi.computation_category === 'Ratio' ? '%' : ''

  return (
    <div className="space-y-4 bg-white p-4 sm:p-5">
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug text-ui-text">{kpi.name}</p>
        <p className="mt-1 text-xs text-ui-muted">
          {kpi.code} · {kpi.frequency} · {kpi.computation_category}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-sm bg-ui-subtle px-2 py-1 text-xs font-medium text-ui-text">
            Weight {kpi.weight_percentage}%
          </span>
          <span className="rounded-sm bg-ui-subtle px-2 py-1 text-xs font-medium text-ui-text">
            Annual target {kpi.target_value}
            {unitSuffix}
          </span>
          {isCumulative ? cumulativeChip() : null}
        </div>
        {isCumulative && kpi.reporting_hint ? (
          <p className="mt-3 rounded-sm border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs leading-relaxed text-blue-900">
            {kpi.reporting_hint}
          </p>
        ) : null}
        {isCumulative && priorReports.length > 0 ? (
          <div className="mt-3 rounded-sm border border-ui-border bg-ui-subtle/40 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ui-muted">
              Earlier this year (YTD reported)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {priorReports.map((p) => (
                <span
                  key={p.report_type}
                  className="rounded-sm bg-white px-2 py-1 text-xs font-medium text-ui-text ring-1 ring-ui-border"
                >
                  {p.label}: {p.actual_value}
                  {unitSuffix}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <Input
            {...mt}
            type="number"
            label={isCumulative ? 'Year-to-date actual (cumulative)' : 'Actual achieved'}
            className="!min-w-0"
            value={actualValue}
            onChange={(e) => onDraftChange(kpi.ppa_kpi_id, { actual: e.target.value })}
            containerProps={{ className: 'min-w-0 w-full' }}
          />
          {belowPrior ? (
            <p className="mt-1.5 text-xs text-amber-700">
              Cumulative value is below {lastPrior}
              {unitSuffix} reported in the previous period. Year-to-date totals should not decrease.
            </p>
          ) : null}
        </div>
        <div className="min-w-0 rounded-sm border border-ui-border bg-ui-subtle/30 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ui-muted">
            {isCumulative ? 'YTD progress vs annual target' : 'Progress vs target'}
          </p>
          <Progress
            {...mt}
            value={progressClamped}
            color={progressClamped >= 80 ? 'green' : progressClamped >= 50 ? 'amber' : 'red'}
            className="rounded-sm"
          />
          <p className="mt-2 text-right text-sm font-semibold text-ui-text">{Math.round(progressClamped)}%</p>
        </div>
      </div>

      <div className="min-w-0">
        <Textarea
          {...mt}
          label="Narrative / evidence"
          rows={3}
          value={narrativeValue}
          onChange={(e) => onDraftChange(kpi.ppa_kpi_id, { narrative: e.target.value })}
          containerProps={{ className: 'min-w-0' }}
        />
      </div>
    </div>
  )
}

export function PerformancePage() {
  const { quarter, staffId } = useAuthStore()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')
  const [reportType, setReportType] = useState('q1')
  const [planWeights, setPlanWeights] = useState<Record<number, string>>({})
  const [planTargets, setPlanTargets] = useState<Record<number, string>>({})
  const [reportDraft, setReportDraft] = useState<
    Record<number, { actual: string; narrative: string }>
  >({})
  const [selectedReviewReportId, setSelectedReviewReportId] = useState<number | null>(null)
  const [reviewDrafts, setReviewDrafts] = useState<
    Record<string, { comments: string; job_title: string }>
  >({})
  const [planAlert, setPlanAlert] = useState<{ type: FormStatusType; message: string; title?: string } | null>(
    null,
  )

  const summaryQuery = useQuery({
    queryKey: ['performance', 'summary'],
    queryFn: () => performanceService.summary(),
    enabled: Boolean(staffId),
  })

  const groupedQuery = useQuery({
    queryKey: ['performance', 'kpis', 'grouped'],
    queryFn: () => performanceService.listKpis(),
    enabled: Boolean(staffId) && (activeTab === 'planning' || activeTab === 'overview'),
  })

  const reportFormQuery = useQuery({
    queryKey: ['performance', 'report-form', reportType],
    queryFn: () => performanceService.reportForm(reportType),
    enabled: Boolean(staffId) && activeTab === 'reporting',
    retry: false,
  })

  useEffect(() => {
    if (activeTab !== 'reporting' || !reportFormQuery.data) {
      return
    }
    if (reportFormQuery.data.report_type && reportFormQuery.data.report_type !== reportType) {
      return
    }
    const groups = asArray<ReportGroup>(reportFormQuery.data.subject_groups)
    const next: Record<number, { actual: string; narrative: string }> = {}
    for (const group of groups) {
      for (const kpi of asArray<ReportKpi>(group.kpis)) {
        next[kpi.ppa_kpi_id] = {
          actual: formatReportActual(kpi.actual_value),
          narrative: kpi.narrative ?? '',
        }
      }
    }
    setReportDraft(next)
  }, [activeTab, reportFormQuery.data, reportType])

  const pendingAppraisalsQuery = useQuery({
    queryKey: ['performance', 'pending-appraisals'],
    queryFn: () => performanceService.listPendingAppraisals(),
    enabled: Boolean(staffId),
  })

  const reviewAppraisalQuery = useQuery({
    queryKey: ['performance', 'appraisal', selectedReviewReportId],
    queryFn: () => performanceService.getAppraisal(selectedReviewReportId!),
    enabled: Boolean(staffId) && activeTab === 'supervisor' && selectedReviewReportId != null,
  })

  const appraisalBundle = reportFormQuery.data?.appraisal as AppraisalBundle | undefined
  const {
    actionPlans,
    setActionPlans,
    appraiseeComments,
    setAppraiseeComments,
  } = useAppraisalFormState(appraisalBundle)

  const reviewAppraisalBundle = reviewAppraisalQuery.data as AppraisalBundle | undefined
  const reviewFormState = useAppraisalFormState(
    activeTab === 'supervisor' ? reviewAppraisalBundle : null,
  )

  const savePlanMutation = useMutation({
    mutationFn: () => {
      const allKpis = asArray<SubjectGroup>(groupedQuery.data).flatMap((g) => g.kpis ?? [])
      const kpis = allKpis.filter((k) => Number(planWeights[k.id] ?? k.weight_percentage ?? 0) > 0)
      return performanceService.savePlan({
        kpis: kpis.map((k) => ({
          kpi_id: k.id,
          weight_percentage: Number(planWeights[k.id] ?? k.weight_percentage ?? 0),
          target_value: Number(
            planTargets[k.id] ?? k.target_value ?? k.default_target ?? 100,
          ),
        })),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance'] })
      const msg = 'Your performance plan has been saved. You can continue editing or submit when total weight is 100%.'
      setPlanAlert({ type: 'success', title: 'Plan saved', message: msg })
      toast.success(msg, 'PPA saved')
    },
    onError: (error: unknown) => {
      const msg = extractErrorMessage(error)
      setPlanAlert({ type: 'error', title: 'Could not save plan', message: msg })
      notifyApiError(error, 'Could not save performance plan')
    },
  })

  const submitPlanMutation = useMutation({
    mutationFn: () => performanceService.submitPlan(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance'] })
      const msg = 'Your PPA has been submitted for supervisor review.'
      setPlanAlert({ type: 'success', title: 'PPA submitted', message: msg })
      toast.success(msg, 'PPA submitted')
    },
    onError: (error: unknown) => {
      const msg = extractErrorMessage(error)
      setPlanAlert({ type: 'error', title: 'Submission failed', message: msg })
      notifyApiError(error, 'Could not submit performance plan')
    },
  })

  const saveAppraisalMutation = useMutation({
    mutationFn: () =>
      performanceService.saveAppraisal({
        report_type: 'endterm',
        action_plans: actionPlans,
        appraisee_comments: appraiseeComments,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance'] })
      toast.success('Appraisal sections saved.', 'Saved')
    },
    onError: (error: unknown) => notifyApiError(error, 'Could not save appraisal'),
  })

  const submitReportMutation = useMutation({
    mutationFn: async () => {
      if (reportType === 'endterm') {
        await performanceService.saveAppraisal({
          report_type: 'endterm',
          action_plans: actionPlans,
          appraisee_comments: appraiseeComments,
        })
      }
      const groups = asArray<ReportGroup>(reportFormQuery.data?.subject_groups)
      const entries = groups.flatMap((g) =>
        g.kpis.map((k) => ({
          ppa_kpi_id: k.ppa_kpi_id,
          actual_value: Number(reportDraft[k.ppa_kpi_id]?.actual ?? k.actual_value ?? 0),
          narrative: reportDraft[k.ppa_kpi_id]?.narrative ?? k.narrative ?? '',
        })),
      )
      return performanceService.submitReport({ report_type: reportType, entries })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance'] })
      toast.success(`${reportType.toUpperCase()} report submitted successfully.`, 'Report submitted')
    },
    onError: (error: unknown) => notifyApiError(error, 'Could not submit report'),
  })

  const reviewAppraisalMutation = useMutation({
    mutationFn: (payload: {
      report_id: number
      decision: 'approve' | 'return'
      comments: string
      job_title: string
      comment_role: string
    }) => performanceService.reviewAppraisal(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance'] })
      setReviewDrafts({})
      toast.success('Appraisal review recorded.', 'Review submitted')
    },
    onError: (error: unknown) => notifyApiError(error, 'Could not submit review'),
  })

  const groups = asArray<SubjectGroup>(groupedQuery.data)
  const ppaStatus = String(summaryQuery.data?.ppa?.status ?? 'draft')
  const ppaSubmitted = ppaStatus !== 'draft'
  const reportingConfig = summaryQuery.data?.reporting_config as
    | { test_override?: boolean; enforce_windows?: boolean }
    | undefined
  const quarterWindows = asArray<QuarterMeta>(summaryQuery.data?.quarters)
  const ppaWindow = summaryQuery.data?.ppa_window as QuarterMeta | undefined
  const ppaWindowOpen = ppaWindow?.is_open !== false
  const activeReportWindow = quarterWindows.find((q) => q.id === reportType)
  const reportWindowOpen = activeReportWindow?.is_open !== false

  const summarySubjectGroups = asArray<{
    subject_area_name: string
    kpis: Array<Record<string, unknown>>
  }>(summaryQuery.data?.subject_groups)

  const subjectGroups =
    summarySubjectGroups.length > 0
      ? summarySubjectGroups
      : groups.map((g) => ({
          subject_area_name: g.subject_area_name,
          kpis: asArray<KpiItem>(g.kpis).map((k) => ({
            name: k.name,
            weight: k.weight_percentage ?? 0,
            target: k.target_value ?? 0,
            source: k.source,
            is_mandatory: k.is_mandatory,
          })),
        }))

  const totalWeight = groups
    .flatMap((g) => asArray<KpiItem>(g.kpis))
    .reduce(
      (sum, k) => sum + Number(planWeights[k.id] ?? (k.in_current_ppa ? k.weight_percentage : 0) ?? 0),
      0,
    )

  const reportGroups = asArray<ReportGroup>(reportFormQuery.data?.subject_groups)
  const hasCumulativeKpis = reportGroups.some((g) =>
    asArray<ReportKpi>(g.kpis).some((k) => k.is_cumulative),
  )
  const reportError = reportFormQuery.isError ? extractErrorMessage(reportFormQuery.error) : null
  const pendingAppraisals = asArray<{
    report_id: number
    staff_id: number
    staff_name: string
    report_label: string
    status: string
    can_act: boolean
    submitted_at?: string
  }>(pendingAppraisalsQuery.data)
  const pendingActionCount = pendingAppraisals.filter((p) => p.can_act).length
  const reportAlreadySubmitted =
    Boolean(appraisalBundle?.report_status) &&
    appraisalBundle?.report_status !== 'draft' &&
    appraisalBundle?.report_status !== '' &&
    appraisalBundle?.report_status !== 'returned'

  const handleSubmitPlan = () => {
    if (!ppaWindowOpen) {
      const msg = 'The PPA planning window is closed. You cannot submit right now.'
      setPlanAlert({ type: 'warning', title: 'Window closed', message: msg })
      toast.warning(msg, 'PPA closed')
      return
    }
    if (totalWeight < 99.9 || totalWeight > 100.1) {
      const msg = `Total KPI weight is ${totalWeight.toFixed(1)}%. Adjust weights until the total equals exactly 100% before submitting.`
      setPlanAlert({ type: 'warning', title: 'Weights must total 100%', message: msg })
      toast.warning(msg, 'Check weights')
      return
    }
    setPlanAlert(null)
    submitPlanMutation.mutate()
  }

  return (
    <div className="pb-8">
      <PageHeader
        title="Performance Management"
        subtitle={`Plan your year, track KPIs, and file quarterly reports · ${quarter}`}
        actions={
          <Link to="/performance/reports">
            <Button
              {...mt}
              variant="outlined"
              size="sm"
              className="flex items-center gap-2 rounded-sm normal-case"
            >
              <ClipboardList className="h-4 w-4" />
              Reports
            </Button>
          </Link>
        }
      />

      <ProcessGuide title="How performance management works" steps={PERFORMANCE_STEPS} />

      {!staffId ? (
        <Card {...mt} className="rounded-sm border border-uganda-yellow bg-uganda-yellow/10 p-4">
          <Typography {...mt} className="text-sm">
            Sign in with a staff-linked demo account to manage your performance plan and reports.
          </Typography>
        </Card>
      ) : (
        <>
          <Tabs value={activeTab} className="mb-6">
            <TabsHeader {...mt} className="rounded-sm bg-ui-subtle/60">
              <Tab {...mt} value="overview" onClick={() => setActiveTab('overview')}>
                <span className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Overview
                </span>
              </Tab>
              <Tab {...mt} value="planning" onClick={() => setActiveTab('planning')}>
                <span className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Planning (PPA)
                </span>
              </Tab>
              <Tab {...mt} value="reporting" onClick={() => setActiveTab('reporting')}>
                <span className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Reporting
                </span>
              </Tab>
              <Tab {...mt} value="supervisor" onClick={() => setActiveTab('supervisor')}>
                <span className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Supervisor review
                  {pendingActionCount > 0 ? (
                    <span className="ml-1 rounded-full bg-moh-green px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {pendingActionCount}
                    </span>
                  ) : null}
                </span>
              </Tab>
            </TabsHeader>
          </Tabs>

          {activeTab === 'overview' ? (
            <QueryState
              isLoading={summaryQuery.isLoading}
              isError={summaryQuery.isError}
              error={summaryQuery.error}
              label="performance summary"
              variant="metrics"
              onRetry={() => summaryQuery.refetch()}
            >
              {summaryQuery.data ? (
                <>
                  <div className="mb-8 grid gap-4 lg:grid-cols-3">
                    <Card {...mt} className="rounded-sm border border-ui-border bg-white p-5 lg:col-span-2">
                      <Typography {...mt} className="text-xs font-bold uppercase tracking-wide text-ui-muted">
                        Performance Plan Agreement
                      </Typography>
                      <div className="mt-2 flex flex-wrap items-baseline gap-3">
                        <Typography {...mt} className="text-xl font-semibold text-ui-text">
                          {summaryQuery.data.financial_year}
                        </Typography>
                        <Chip
                          {...mt}
                          value={ppaStatus.replace(/_/g, ' ')}
                          className="rounded-sm capitalize"
                        />
                      </div>
                      <p className="mt-1 text-sm text-ui-muted">
                        {summaryQuery.data.ppa?.current_stage ?? '—'}
                      </p>
                      <div className="mt-4">
                        <div className="mb-1 flex justify-between text-sm">
                          <span>Total KPI weight</span>
                          <span className="font-semibold">{summaryQuery.data.ppa?.total_weight ?? 0}%</span>
                        </div>
                        <Progress
                          {...mt}
                          value={Math.min(summaryQuery.data.ppa?.total_weight ?? 0, 100)}
                          color="gray"
                          className="rounded-sm"
                        />
                      </div>
                      {!ppaSubmitted ? (
                        <Button
                          {...mt}
                          size="sm"
                          className="mt-4 rounded-sm bg-moh-green normal-case"
                          onClick={() => setActiveTab('planning')}
                        >
                          Continue planning →
                        </Button>
                      ) : (
                        <Button
                          {...mt}
                          size="sm"
                          variant="outlined"
                          className="mt-4 rounded-sm normal-case"
                          onClick={() => setActiveTab('reporting')}
                        >
                          File a report →
                        </Button>
                      )}
                    </Card>
                    <Card {...mt} className="rounded-sm border border-ui-border bg-ui-subtle/40 p-5">
                      <Typography {...mt} className="text-xs font-bold uppercase text-ui-muted">
                        KPI summary
                      </Typography>
                      <p className="mt-2 text-3xl font-bold text-ui-text">
                        {summaryQuery.data.kpis?.length ?? 0}
                      </p>
                      <p className="text-sm text-ui-muted">indicators in your plan</p>
                      <p className="mt-3 text-xs text-ui-muted">
                        Across {subjectGroups.length} subject area
                        {subjectGroups.length === 1 ? '' : 's'}
                      </p>
                    </Card>
                  </div>

                  {subjectGroups.length > 0 ? (
                    <section>
                      <Typography {...mt} className="mb-4 text-sm font-bold uppercase text-ui-text">
                        Your PPA — grouped by function
                      </Typography>
                      <div className="grid gap-4">
                        {subjectGroups.map((group) => (
                          <Card
                            key={group.subject_area_name}
                            {...mt}
                            className="rounded-sm border border-ui-border border-l-4 border-l-uganda-yellow bg-white p-4"
                          >
                            <Typography {...mt} className="mb-3 font-semibold text-ui-text">
                              {group.subject_area_name}
                            </Typography>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[600px] text-left text-sm">
                                <thead>
                                  <tr className="border-b text-xs uppercase text-ui-muted">
                                    <th className="py-2 pr-4">Indicator</th>
                                    <th className="py-2 pr-4">Source</th>
                                    <th className="py-2 pr-4 text-right">Weight</th>
                                    <th className="py-2 text-right">Target</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.kpis.map((kpi) => (
                                    <tr key={String(kpi.name)} className="border-b border-ui-border/50">
                                      <td className="py-2.5 pr-4">{String(kpi.name)}</td>
                                      <td className="py-2.5 pr-4">
                                        {sourceChip(String(kpi.source ?? 'individual'), Boolean(kpi.is_mandatory))}
                                      </td>
                                      <td className="py-2.5 pr-4 text-right font-medium">
                                        {Number(kpi.weight ?? 0)}%
                                      </td>
                                      <td className="py-2.5 text-right">{Number(kpi.target ?? 0)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </>
              ) : null}
            </QueryState>
          ) : null}

          {activeTab === 'planning' ? (
            <Card {...mt} className="overflow-hidden rounded-sm border border-ui-border p-5 sm:p-6">
              {!ppaWindowOpen ? (
                <Card {...mt} className="mb-4 rounded-sm border border-moh-warning/40 bg-moh-warning/10 p-4">
                  <Typography {...mt} className="text-sm text-ui-text">
                    PPA planning is closed. Window: {ppaWindow?.reporting_window ?? 'July – September'}.
                    {ppaWindow?.open_at ? ` Opens ${formatWindowDate(ppaWindow.open_at)}.` : ''}
                  </Typography>
                </Card>
              ) : reportingConfig?.test_override ? (
                <Card {...mt} className="mb-4 rounded-sm border border-moh-green/30 bg-moh-green/5 p-4">
                  <Typography {...mt} className="text-sm text-ui-text">
                    Test override is on — all reporting windows are open for testing.
                  </Typography>
                </Card>
              ) : ppaWindow?.days_remaining ? (
                <Card {...mt} className="mb-4 rounded-sm border border-ui-border bg-ui-subtle/40 p-4">
                  <Typography {...mt} className="text-sm text-ui-muted">
                    PPA window open · {ppaWindow.days_remaining} day
                    {ppaWindow.days_remaining === 1 ? '' : 's'} remaining (closes{' '}
                    {formatWindowDate(ppaWindow.close_at)})
                  </Typography>
                </Card>
              ) : null}
              <Typography {...mt} className="mb-2 text-sm font-bold uppercase text-ui-text">
                Edit performance plan
              </Typography>
              <Typography {...mt} className="mb-4 text-sm text-ui-muted">
                Mandatory KPIs are pre-assigned to your role. Adjust weights and targets until the total
                equals 100%, then save and submit for supervisor review.
              </Typography>
              {planAlert ? (
                <FormStatusAlert
                  type={planAlert.type}
                  title={planAlert.title}
                  message={planAlert.message}
                  onDismiss={() => setPlanAlert(null)}
                  className="mb-4"
                />
              ) : null}
              <QueryState
                isLoading={groupedQuery.isLoading}
                isError={groupedQuery.isError}
                error={groupedQuery.error}
                label="assigned KPIs"
                variant="form"
                onRetry={() => groupedQuery.refetch()}
              >
                <div className="space-y-4">
                  {groups.map((group) => (
                    <div key={group.subject_area_id}>
                      <h3
                        className={cn(
                          'mb-4 border-l-4 pl-3 text-sm font-bold uppercase tracking-wide text-ui-text',
                          SUBJECT_COLORS[group.subject_area_id] ?? 'border-l-gray-400',
                        )}
                      >
                        {group.subject_area_name}
                      </h3>
                      <div className="space-y-4">
                        {asArray<KpiItem>(group.kpis).map((kpi) => (
                          <KpiPlanningRow
                            key={kpi.id}
                            kpi={kpi}
                            planWeights={planWeights}
                            planTargets={planTargets}
                            onWeightChange={(id, value) =>
                              setPlanWeights((p) => ({ ...p, [id]: value }))
                            }
                            onTargetChange={(id, value) =>
                              setPlanTargets((p) => ({ ...p, [id]: value }))
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <Card {...mt} className="mt-6 rounded-sm border border-ui-border bg-ui-subtle/30 p-4">
                  <p className="text-sm">
                    Total weight:{' '}
                    <strong
                      className={
                        totalWeight >= 99.9 && totalWeight <= 100.1
                          ? 'text-moh-green'
                          : 'text-moh-warning'
                      }
                    >
                      {totalWeight.toFixed(1)}%
                    </strong>
                    {totalWeight < 99.9 || totalWeight > 100.1
                      ? ' — must equal 100% to submit'
                      : ' — ready to submit'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    {...mt}
                    className="rounded-sm bg-moh-green normal-case"
                    disabled={savePlanMutation.isPending || !ppaWindowOpen}
                    onClick={() => {
                      setPlanAlert(null)
                      savePlanMutation.mutate()
                    }}
                  >
                    Save plan
                  </Button>
                  <Button
                    {...mt}
                    variant="outlined"
                    className="rounded-sm normal-case"
                    disabled={submitPlanMutation.isPending || !ppaWindowOpen}
                    onClick={handleSubmitPlan}
                  >
                    Submit for supervisor review
                  </Button>
                  </div>
                </Card>
              </QueryState>
            </Card>
          ) : null}

          {activeTab === 'reporting' ? (
            <Card {...mt} className="rounded-sm border border-ui-border p-5 sm:p-6">
              <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <Typography {...mt} className="text-sm font-bold uppercase text-ui-text">
                    Quarterly KPI reporting
                  </Typography>
                  <Typography {...mt} className="mt-1 text-sm text-ui-muted">
                    {reportFormQuery.data?.financial_year ?? summaryQuery.data?.financial_year} · PPA
                    status: {reportFormQuery.data?.ppa_status ?? ppaStatus}
                  </Typography>
                </div>
                <ReportPeriodPicker
                  reportType={reportType}
                  quarterWindows={quarterWindows}
                  onSelect={setReportType}
                />
              </div>

              {reportingConfig?.test_override ? (
                <Card {...mt} className="mb-4 rounded-sm border border-moh-green/30 bg-moh-green/5 p-4">
                  <Typography {...mt} className="text-sm text-ui-text">
                    Test override is on — you can file any report period for testing.
                  </Typography>
                </Card>
              ) : null}

              {!reportWindowOpen && ppaSubmitted ? (
                <Card {...mt} className="mb-4 rounded-sm border border-moh-warning/40 bg-moh-warning/10 p-4">
                  <Typography {...mt} className="text-sm text-ui-text">
                    {activeReportWindow?.reporting_window
                      ? `${activeReportWindow.label} reporting window: ${activeReportWindow.reporting_window}.`
                      : 'This reporting period is not open.'}
                    {activeReportWindow?.status === 'upcoming' && activeReportWindow.open_at
                      ? ` Opens ${formatWindowDate(activeReportWindow.open_at)}.`
                      : activeReportWindow?.status === 'closed' && activeReportWindow.close_at
                        ? ` Closed ${formatWindowDate(activeReportWindow.close_at)}.`
                        : ''}
                  </Typography>
                </Card>
              ) : null}

              {reportWindowOpen && activeReportWindow?.days_remaining ? (
                <Card {...mt} className="mb-4 rounded-sm border border-ui-border bg-ui-subtle/40 p-4">
                  <Typography {...mt} className="text-sm text-ui-muted">
                    {activeReportWindow.label} window open · {activeReportWindow.days_remaining} day
                    {activeReportWindow.days_remaining === 1 ? '' : 's'} remaining
                  </Typography>
                </Card>
              ) : null}

              {!ppaSubmitted && !reportFormQuery.isLoading ? (
                <Card {...mt} className="mb-4 rounded-sm border border-moh-warning/40 bg-moh-warning/10 p-4">
                  <Typography {...mt} className="text-sm text-ui-text">
                    Submit your performance plan before filing reports. Go to the{' '}
                    <button
                      type="button"
                      className="font-semibold text-moh-green underline"
                      onClick={() => setActiveTab('planning')}
                    >
                      Planning tab
                    </button>{' '}
                    to complete and submit your PPA.
                  </Typography>
                </Card>
              ) : null}

              {reportError ? (
                <Card {...mt} className="mb-4 rounded-sm border border-red-200 bg-red-50 p-4">
                  <Typography {...mt} className="text-sm text-red-800">
                    {reportError}
                  </Typography>
                  <Button
                    {...mt}
                    size="sm"
                    variant="text"
                    className="mt-2 normal-case text-moh-green"
                    onClick={() => reportFormQuery.refetch()}
                  >
                    Try again
                  </Button>
                </Card>
              ) : null}

              <QueryState
                isLoading={reportFormQuery.isLoading}
                isError={false}
                error={null}
                label="report form"
                variant="form"
                onRetry={() => reportFormQuery.refetch()}
              >
                <div className="space-y-6">
                  {hasCumulativeKpis ? (
                    <Card {...mt} className="rounded-sm border border-blue-200 bg-blue-50/50 p-4">
                      <div className="flex gap-3">
                        <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                        <div>
                          <Typography {...mt} className="text-sm font-semibold text-blue-900">
                            Cumulative indicators in this report
                          </Typography>
                          <Typography {...mt} className="mt-1 text-sm text-blue-900/90">
                            Some KPIs are tracked cumulatively. Enter your{' '}
                            <strong>year-to-date total</strong> for each period — not just this
                            quarter&apos;s increment. Progress is measured against your{' '}
                            <strong>annual target</strong> as performance builds through the financial
                            year.
                          </Typography>
                        </div>
                      </div>
                    </Card>
                  ) : null}
                  {reportGroups.map((group) => (
                    <div
                      key={group.subject_area_name}
                      className="overflow-hidden rounded-sm border border-ui-border shadow-sm"
                    >
                      <div className="border-b border-ui-border bg-gradient-to-r from-moh-green/5 to-white px-4 py-3 sm:px-5">
                        <Typography {...mt} className="font-semibold text-ui-text">
                          {group.subject_area_name}
                        </Typography>
                        <Typography {...mt} className="text-xs text-ui-muted">
                          {group.kpis.length} indicator{group.kpis.length === 1 ? '' : 's'}
                        </Typography>
                      </div>
                      <div className="divide-y divide-ui-border bg-ui-subtle/20">
                        {group.kpis.map((kpi) => (
                          <KpiReportRow
                            key={kpi.ppa_kpi_id}
                            kpi={kpi}
                            reportDraft={reportDraft}
                            onDraftChange={(ppaKpiId, patch) =>
                              setReportDraft((p) => ({
                                ...p,
                                [ppaKpiId]: {
                                  actual:
                                    patch.actual ??
                                    p[ppaKpiId]?.actual ??
                                    formatReportActual(
                                      reportGroups
                                        .flatMap((g) => g.kpis)
                                        .find((k) => k.ppa_kpi_id === ppaKpiId)?.actual_value,
                                    ),
                                  narrative:
                                    patch.narrative ??
                                    p[ppaKpiId]?.narrative ??
                                    reportGroups
                                      .flatMap((g) => g.kpis)
                                      .find((k) => k.ppa_kpi_id === ppaKpiId)?.narrative ??
                                    '',
                                },
                              }))
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {reportType === 'endterm' && appraisalBundle ? (
                  <div className="mt-8 border-t border-ui-border pt-8">
                    <PerformanceAppraisalSections
                      appraisal={appraisalBundle}
                      actionPlans={actionPlans}
                      appraiseeComments={appraiseeComments}
                      onActionPlansChange={setActionPlans}
                      onAppraiseeCommentsChange={setAppraiseeComments}
                      onSaveDraft={
                        appraisalBundle.can_edit_action_plan
                          ? () => saveAppraisalMutation.mutate()
                          : undefined
                      }
                      savingDraft={saveAppraisalMutation.isPending}
                    />
                    {saveAppraisalMutation.isSuccess ? (
                      <Typography {...mt} className="mt-2 text-sm text-moh-green">
                        Appraisal sections saved.
                      </Typography>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-6 rounded-sm border border-ui-border bg-ui-subtle/30 p-4">
                  <Button
                    {...mt}
                    className="rounded-sm bg-moh-green normal-case"
                    disabled={
                      submitReportMutation.isPending ||
                      reportGroups.length === 0 ||
                      !ppaSubmitted ||
                      !reportWindowOpen ||
                      reportAlreadySubmitted
                    }
                    onClick={() => submitReportMutation.mutate()}
                  >
                    Submit {reportType.toUpperCase()} report
                  </Button>
                {submitReportMutation.isSuccess ? (
                  <Typography {...mt} className="mt-2 text-sm text-moh-green">
                    Report submitted successfully.
                  </Typography>
                ) : null}
                {submitReportMutation.isError ? (
                  <Typography {...mt} className="mt-2 text-sm text-moh-error">
                    {extractErrorMessage(submitReportMutation.error)}
                  </Typography>
                ) : null}
                </div>
              </QueryState>
            </Card>
          ) : null}

          {activeTab === 'supervisor' ? (
            <Card {...mt} className="rounded-sm border border-ui-border p-5 sm:p-6">
              <Typography {...mt} className="text-sm font-bold uppercase text-ui-text">
                End of year appraisal reviews
              </Typography>
              <Typography {...mt} className="mt-1 text-sm text-ui-muted">
                Review supervised staff appraisals — add appraiser comments and approve or return
                reports.
              </Typography>

              <QueryState
                isLoading={pendingAppraisalsQuery.isLoading}
                isError={pendingAppraisalsQuery.isError}
                error={pendingAppraisalsQuery.error}
                label="pending appraisals"
                variant="table"
                onRetry={() => pendingAppraisalsQuery.refetch()}
              >
                {pendingAppraisals.length === 0 ? (
                  <Card {...mt} className="mt-4 rounded-sm border border-ui-border bg-ui-subtle/30 p-4">
                    <Typography {...mt} className="text-sm text-ui-muted">
                      No pending end of year appraisals for your team.
                    </Typography>
                  </Card>
                ) : (
                  <div className="mt-4 space-y-3">
                    {pendingAppraisals.map((item) => (
                      <button
                        key={item.report_id}
                        type="button"
                        onClick={() => setSelectedReviewReportId(item.report_id)}
                        className={cn(
                          'w-full rounded-sm border px-4 py-3 text-left transition',
                          selectedReviewReportId === item.report_id
                            ? 'border-moh-green bg-moh-green/5'
                            : 'border-ui-border bg-white hover:border-moh-green/40',
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-ui-text">{item.staff_name}</span>
                          <Chip
                            {...mt}
                            size="sm"
                            value={item.can_act ? 'Action required' : item.status.replace(/_/g, ' ')}
                            className={cn(
                              'rounded-sm capitalize',
                              item.can_act ? 'bg-moh-green text-white' : 'bg-ui-subtle',
                            )}
                          />
                        </div>
                        <p className="mt-1 text-sm text-ui-muted">{item.report_label}</p>
                      </button>
                    ))}
                  </div>
                )}

                {selectedReviewReportId != null && reviewAppraisalBundle ? (
                  <div className="mt-8 border-t border-ui-border pt-8">
                    <PerformanceAppraisalSections
                      appraisal={reviewAppraisalBundle}
                      actionPlans={reviewFormState.actionPlans}
                      appraiseeComments={reviewFormState.appraiseeComments}
                      onActionPlansChange={reviewFormState.setActionPlans}
                      onAppraiseeCommentsChange={reviewFormState.setAppraiseeComments}
                      reviewMode
                      reviewDrafts={reviewDrafts}
                      onReviewDraftChange={(key, patch) =>
                        setReviewDrafts((prev) => ({
                          ...prev,
                          [key]: {
                            comments: prev[key]?.comments ?? '',
                            job_title: prev[key]?.job_title ?? '',
                            ...patch,
                          },
                        }))
                      }
                      onReviewSubmit={(key, role, decision) => {
                        const draft = reviewDrafts[key] ?? { comments: '', job_title: '' }
                        reviewAppraisalMutation.mutate({
                          report_id: selectedReviewReportId,
                          decision,
                          comments: draft.comments,
                          job_title: draft.job_title,
                          comment_role: role,
                        })
                      }}
                      reviewing={reviewAppraisalMutation.isPending}
                    />
                    {reviewAppraisalMutation.isSuccess ? (
                      <Typography {...mt} className="mt-2 text-sm text-moh-green">
                        Review recorded successfully.
                      </Typography>
                    ) : null}
                    {reviewAppraisalMutation.isError ? (
                      <Typography {...mt} className="mt-2 text-sm text-moh-error">
                        {extractErrorMessage(reviewAppraisalMutation.error)}
                      </Typography>
                    ) : null}
                  </div>
                ) : null}
              </QueryState>
            </Card>
          ) : null}
        </>
      )}
    </div>
  )
}

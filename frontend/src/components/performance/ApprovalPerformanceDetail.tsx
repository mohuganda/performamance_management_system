import { useQuery } from '@tanstack/react-query'
import { Button, Chip, Progress, Typography } from '@material-tailwind/react'
import { ClipboardList, FileBarChart2 } from 'lucide-react'
import {
  approvalsService,
  type ReviewKpiField,
  type ReviewSubjectGroup,
} from '@/api/services/approvals'
import {
  PerformanceAppraisalSections,
  useAppraisalFormState,
  type AppraisalBundle,
} from '@/components/performance/PerformanceAppraisalSections'
import { mt } from '@/utils/mt'
import { asArray } from '@/utils/asArray'

function formatDate(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatNum(n?: number) {
  if (n == null || Number.isNaN(n)) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function KpiReadOnlyRow({
  kpi,
  mode,
}: {
  kpi: ReviewKpiField
  mode: 'ppa' | 'report'
}) {
  const unit = kpi.computation_category === 'Ratio' ? '%' : ''
  const progress = Math.min(Math.max(kpi.progress_percent ?? 0, 0), 100)
  const priors = asArray<{
    report_type: string
    label: string
    actual_value: number
  }>(kpi.prior_reports)

  return (
    <div className="space-y-3 bg-white p-4 sm:p-5">
      <div>
        <p className="text-sm font-semibold leading-snug text-ui-text">{kpi.name}</p>
        <p className="mt-1 text-xs text-ui-muted">
          {kpi.code}
          {kpi.frequency ? ` · ${kpi.frequency}` : ''}
          {kpi.computation_category ? ` · ${kpi.computation_category}` : ''}
          {kpi.source ? ` · ${kpi.source}` : ''}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-sm bg-ui-subtle px-2 py-1 text-xs font-medium text-ui-text">
            Weight {formatNum(kpi.weight_percentage)}%
          </span>
          <span className="rounded-sm bg-ui-subtle px-2 py-1 text-xs font-medium text-ui-text">
            Target {formatNum(kpi.target_value)}
            {unit}
          </span>
          {kpi.is_cumulative ? (
            <span className="rounded-sm bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800">
              Cumulative
            </span>
          ) : null}
        </div>
      </div>

      {mode === 'report' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-sm border border-ui-border bg-ui-subtle/30 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ui-muted">
              {kpi.is_cumulative ? 'YTD actual' : 'Actual'}
            </p>
            <p className="mt-1 text-base font-semibold text-ui-text">
              {formatNum(kpi.actual_value)}
              {kpi.actual_value != null ? unit : ''}
            </p>
          </div>
          <div className="rounded-sm border border-ui-border bg-ui-subtle/30 px-3 py-2.5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ui-muted">
              Progress vs target
            </p>
            <Progress
              {...mt}
              value={progress}
              color={progress >= 80 ? 'green' : progress >= 50 ? 'amber' : 'red'}
              className="rounded-sm"
            />
            <p className="mt-1.5 text-xs text-ui-muted">{formatNum(progress)}%</p>
          </div>
        </div>
      ) : null}

      {mode === 'report' && priors.length > 0 ? (
        <div className="rounded-sm border border-ui-border bg-ui-subtle/40 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ui-muted">
            Earlier this year (YTD)
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {priors.map((p) => (
              <span
                key={p.report_type}
                className="rounded-sm bg-white px-2 py-1 text-xs font-medium text-ui-text ring-1 ring-ui-border"
              >
                {p.label}: {formatNum(p.actual_value)}
                {unit}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {mode === 'report' && kpi.narrative ? (
        <div className="rounded-sm border border-ui-border bg-white px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ui-muted">
            Narrative / evidence
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ui-text">{kpi.narrative}</p>
        </div>
      ) : null}
    </div>
  )
}

function SubjectGroupsPanel({
  groups,
  mode,
}: {
  groups: ReviewSubjectGroup[]
  mode: 'ppa' | 'report'
}) {
  if (groups.length === 0) {
    return <p className="px-1 py-4 text-sm text-ui-muted">No KPI lines on this submission.</p>
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div
          key={`${group.subject_area_id}-${group.subject_area_name}`}
          className="overflow-hidden rounded-sm border border-ui-border shadow-sm"
        >
          <div className="border-b border-ui-border bg-gradient-to-r from-moh-green/5 to-white px-4 py-3">
            <Typography {...mt} className="font-semibold text-ui-text">
              {group.subject_area_name || 'Other'}
            </Typography>
            <Typography {...mt} className="text-xs text-ui-muted">
              {group.kpis.length} indicator{group.kpis.length === 1 ? '' : 's'}
            </Typography>
          </div>
          <div className="divide-y divide-ui-border bg-ui-subtle/20">
            {group.kpis.map((kpi) => (
              <KpiReadOnlyRow key={kpi.ppa_kpi_id || kpi.kpi_id} kpi={kpi} mode={mode} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function AppraisalReadOnly({ appraisal }: { appraisal: AppraisalBundle }) {
  const readOnly = {
    ...appraisal,
    can_edit_appraisee: false,
    can_edit_action_plan: false,
    comments: appraisal.comments.map((c) => ({ ...c, can_edit: false })),
  }
  const { actionPlans, appraiseeComments } = useAppraisalFormState(readOnly)

  return (
    <PerformanceAppraisalSections
      appraisal={readOnly}
      actionPlans={actionPlans}
      appraiseeComments={appraiseeComments}
      onActionPlansChange={() => undefined}
      onAppraiseeCommentsChange={() => undefined}
    />
  )
}

type Props = {
  kind: 'ppa' | 'report'
  ppaId?: number
  reportId?: number
}

export function ApprovalPerformanceDetail({ kind, ppaId, reportId }: Props) {
  const enabled = kind === 'ppa' ? Boolean(ppaId) : Boolean(reportId)

  const ppaQuery = useQuery({
    queryKey: ['approvals', 'ppa-review-detail', ppaId],
    queryFn: () => approvalsService.getPpaReviewDetail(ppaId!),
    enabled: enabled && kind === 'ppa',
  })

  const reportQuery = useQuery({
    queryKey: ['approvals', 'report-review-detail', reportId],
    queryFn: () => approvalsService.getReportReviewDetail(reportId!),
    enabled: enabled && kind === 'report',
  })

  const query = kind === 'ppa' ? ppaQuery : reportQuery
  const title = kind === 'ppa' ? 'Performance plan details' : 'Performance report details'
  const Icon = kind === 'ppa' ? ClipboardList : FileBarChart2

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="rounded-sm bg-moh-green/10 p-2 text-moh-green">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <Typography {...mt} className="text-sm font-bold uppercase tracking-wide text-moh-green">
            {title}
          </Typography>
          <p className="mt-0.5 text-sm text-ui-muted">
            Review every indicator before you approve or return this submission.
          </p>
        </div>
      </div>

      {query.isLoading ? <p className="text-sm text-ui-muted">Loading full details…</p> : null}
      {query.isError ? (
        <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-sm text-red-800">Could not load details for review.</p>
          <Button
            {...mt}
            size="sm"
            variant="text"
            className="mt-1 normal-case text-moh-green"
            onClick={() => query.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : null}

      {kind === 'ppa' && ppaQuery.data ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Chip
              {...mt}
              size="sm"
              value={ppaQuery.data.financial_year || 'FY'}
              className="normal-case bg-ui-subtle text-ui-text"
            />
            <Chip
              {...mt}
              size="sm"
              value={String(ppaQuery.data.status).replace(/_/g, ' ')}
              className="normal-case capitalize bg-amber-100 text-amber-900"
            />
            <span className="text-xs text-ui-muted">
              Total weight {formatNum(ppaQuery.data.total_weight)}%
              {ppaQuery.data.submitted_at
                ? ` · submitted ${formatDate(ppaQuery.data.submitted_at)}`
                : ''}
            </span>
          </div>
          <SubjectGroupsPanel groups={asArray(ppaQuery.data.subject_groups)} mode="ppa" />
        </>
      ) : null}

      {kind === 'report' && reportQuery.data ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Chip
              {...mt}
              size="sm"
              value={reportQuery.data.report_label || reportQuery.data.report_type}
              className="normal-case bg-amber-100 text-amber-900"
            />
            <Chip
              {...mt}
              size="sm"
              value={reportQuery.data.financial_year || 'FY'}
              className="normal-case bg-ui-subtle text-ui-text"
            />
            <Chip
              {...mt}
              size="sm"
              value={String(reportQuery.data.status).replace(/_/g, ' ')}
              className="normal-case capitalize bg-sky-100 text-sky-900"
            />
            <span className="text-xs text-ui-muted">
              PPA {String(reportQuery.data.ppa_status ?? '—').replace(/_/g, ' ')}
              {reportQuery.data.submitted_at
                ? ` · submitted ${formatDate(reportQuery.data.submitted_at)}`
                : ''}
            </span>
          </div>
          <SubjectGroupsPanel groups={asArray(reportQuery.data.subject_groups)} mode="report" />
          {reportQuery.data.appraisal ? (
            <div className="border-t border-ui-border pt-4">
              <AppraisalReadOnly appraisal={reportQuery.data.appraisal} />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Chip, Textarea, Typography } from '@material-tailwind/react'
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  XCircle,
} from 'lucide-react'
import { approvalsService } from '@/api/services/approvals'
import { ApprovalPerformanceDetail } from '@/components/performance/ApprovalPerformanceDetail'
import {
  ApprovalWorkflowPanel,
  type ApprovalTrailEntry,
  type ApprovalWorkflowStep,
} from '@/components/molecules/ApprovalWorkflowPanel'
import { PageHeader } from '@/components/organisms/PageHeader'
import { QueryState } from '@/components/organisms/QueryState'
import { notifyApiError, toast } from '@/features/toast'
import { useAuthStore } from '@/stores/appStore'
import { mt } from '@/utils/mt'
import { asArray } from '@/utils/asArray'
import { cn } from '@/utils/cn'

const MODULES = ['leave', 'oos', 'ppa', 'performance'] as const
type ApprovalModule = (typeof MODULES)[number]

const MODULE_META: Record<
  ApprovalModule,
  { chip: string; icon: typeof CalendarDays }
> = {
  leave: { chip: 'bg-sky-100 text-sky-800', icon: CalendarDays },
  oos: { chip: 'bg-violet-100 text-violet-800', icon: MapPin },
  performance: { chip: 'bg-amber-100 text-amber-900', icon: BarChart3 },
  ppa: { chip: 'bg-emerald-100 text-emerald-800', icon: BarChart3 },
}

function isApprovalModule(value: string | undefined): value is ApprovalModule {
  return MODULES.includes(value as ApprovalModule)
}

function formatSubmitted(iso?: string) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function ApprovalDetailPage() {
  const { module, refId: refIdParam } = useParams()
  const navigate = useNavigate()
  const { staffId } = useAuthStore()
  const queryClient = useQueryClient()
  const [comments, setComments] = useState('')

  const refId = Number(refIdParam)
  const moduleOk = isApprovalModule(module)
  const refOk = Number.isFinite(refId) && refId > 0

  const detailQuery = useQuery({
    queryKey: ['approvals', 'detail', module, refId],
    queryFn: () => approvalsService.getDetail(module!, refId),
    enabled: Boolean(staffId) && moduleOk && refOk,
    retry: false,
  })

  const detail = detailQuery.data
  const approvers = asArray<ApprovalWorkflowStep>(detail?.approvers)
  const trail = asArray<ApprovalTrailEntry>(detail?.trail)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['approvals'] })
    queryClient.invalidateQueries({ queryKey: ['leave'] })
    queryClient.invalidateQueries({ queryKey: ['oos'] })
    queryClient.invalidateQueries({ queryKey: ['performance'] })
  }

  const actMutation = useMutation({
    mutationFn: async (approve: boolean) => {
      if (!detail) throw new Error('Approval item not found')
      const note = comments.trim()
      if (detail.module === 'leave' && detail.approval_id) {
        return approvalsService.approveLeave(detail.approval_id, { approve, comments: note })
      }
      if (detail.module === 'oos' && detail.approval_id) {
        return approvalsService.approveOos(detail.approval_id, { approve, comments: note })
      }
      if (detail.module === 'ppa' && detail.ppa_id) {
        return approvalsService.reviewPpa({ ppa_id: detail.ppa_id, approve, comments: note })
      }
      if (detail.module === 'performance' && detail.report_id) {
        return approvalsService.reviewAppraisal({
          report_id: detail.report_id,
          decision: approve ? 'approve' : 'return',
          comments: note || (approve ? 'Approved' : 'Returned for revision'),
          comment_role:
            detail.status === 'countersigning'
              ? 'countersigning'
              : detail.status === 'responsible_review'
                ? 'responsible_officer'
                : 'appraiser',
        })
      }
      throw new Error('Unsupported approval item')
    },
    onSuccess: (_data, approve) => {
      toast.success(approve ? 'Request approved successfully.' : 'Request returned or rejected.')
      invalidate()
      navigate('/approvals')
    },
    onError: (error: unknown) => notifyApiError(error, 'Could not complete approval action'),
  })

  const headerTitle = useMemo(
    () => detail?.staff_name ?? 'Review approval',
    [detail?.staff_name],
  )

  if (!moduleOk || !refOk) {
    return (
      <div className="space-y-4 pb-10">
        <PageHeader title="Approval not found" subtitle="This approval link is invalid." />
        <Link to="/approvals" className="text-sm font-medium text-moh-green hover:underline">
          Back to approvals
        </Link>
      </div>
    )
  }

  const style = MODULE_META[module]
  const Icon = style.icon
  const reason = detail?.reason?.trim() ?? ''
  const rejectLabel =
    detail?.module === 'performance' || detail?.module === 'ppa' ? 'Return' : 'Reject'

  return (
    <div className="space-y-6 pb-12">
      <div>
        <Link
          to="/approvals"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-moh-green hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to approvals
        </Link>
        <PageHeader
          title={headerTitle}
          subtitle={
            detail
              ? `${detail.type_label} · ${detail.title}`
              : 'Open the full submission, then approve or return.'
          }
        />
      </div>

      <QueryState
        isLoading={detailQuery.isLoading}
        isError={detailQuery.isError}
        error={detailQuery.error}
        label="approval details"
        variant="dashboard"
        onRetry={() => detailQuery.refetch()}
      >
        {!detail ? (
          <Card {...mt} className="rounded-sm border border-ui-border p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-10 w-10 text-moh-green/50" />
            <p className="mt-3 text-sm font-medium text-ui-text">This item is no longer available</p>
            <p className="mt-1 text-sm text-ui-muted">
              It may already have been approved, returned, or removed from your inbox.
            </p>
            <Button
              {...mt}
              size="sm"
              className="mt-4 rounded-sm bg-moh-green normal-case"
              onClick={() => navigate('/approvals')}
            >
              Return to inbox
            </Button>
          </Card>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-5">
              <Card {...mt} className="rounded-sm border border-moh-green/15 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className={cn(
                        'rounded-sm p-2.5',
                        module === 'leave' && 'bg-sky-50 text-sky-700',
                        module === 'oos' && 'bg-violet-50 text-violet-700',
                        module === 'ppa' && 'bg-emerald-50 text-emerald-800',
                        module === 'performance' && 'bg-amber-50 text-amber-900',
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip
                          {...mt}
                          size="sm"
                          value={detail.type_label}
                          className={cn('normal-case', style.chip)}
                        />
                        {detail.stage_name ? (
                          <span className="text-xs font-semibold uppercase tracking-wide text-moh-green">
                            {detail.stage_name}
                          </span>
                        ) : null}
                      </div>
                      <Typography {...mt} className="mt-2 text-xl font-semibold text-ui-text">
                        {detail.staff_name}
                      </Typography>
                      <p className="mt-1 text-sm font-medium text-gray-800">{detail.title}</p>
                      <p className="mt-1 text-sm text-ui-muted">{detail.subtitle}</p>
                    </div>
                  </div>
                  <div className="rounded-sm border border-ui-border bg-ui-subtle/40 px-3 py-2 text-right">
                    <p className="flex items-center justify-end gap-1.5 text-xs uppercase tracking-wide text-ui-muted">
                      <Clock3 className="h-3.5 w-3.5" />
                      Status
                    </p>
                    <p className="mt-1 text-sm font-semibold capitalize text-ui-text">
                      {String(detail.status || 'pending').replace(/_/g, ' ')}
                    </p>
                    {formatSubmitted(detail.submitted_at) ? (
                      <p className="mt-0.5 text-xs text-ui-muted">
                        {formatSubmitted(detail.submitted_at)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </Card>

              <Card {...mt} className="rounded-sm border border-ui-border p-5 shadow-sm sm:p-6">
                {detail.module === 'ppa' && detail.ppa_id ? (
                  <ApprovalPerformanceDetail kind="ppa" ppaId={detail.ppa_id} />
                ) : null}
                {detail.module === 'performance' && detail.report_id ? (
                  <ApprovalPerformanceDetail kind="report" reportId={detail.report_id} />
                ) : null}
                {(detail.module === 'leave' || detail.module === 'oos') && (
                  <div className="space-y-4">
                    <Typography
                      {...mt}
                      className="text-sm font-bold uppercase tracking-wide text-moh-green"
                    >
                      Request details
                    </Typography>
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-sm border border-ui-border bg-ui-subtle/30 px-3 py-2.5">
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-ui-muted">
                          Staff
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-ui-text">{detail.staff_name}</dd>
                      </div>
                      <div className="rounded-sm border border-ui-border bg-ui-subtle/30 px-3 py-2.5">
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-ui-muted">
                          Type
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-ui-text">{detail.title}</dd>
                      </div>
                      <div className="rounded-sm border border-ui-border bg-ui-subtle/30 px-3 py-2.5 sm:col-span-2">
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-ui-muted">
                          Period / destination
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-ui-text">{detail.subtitle}</dd>
                      </div>
                      {detail.stage_name ? (
                        <div className="rounded-sm border border-ui-border bg-ui-subtle/30 px-3 py-2.5">
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-ui-muted">
                            Your stage
                          </dt>
                          <dd className="mt-1 text-sm font-medium text-ui-text">{detail.stage_name}</dd>
                        </div>
                      ) : null}
                      <div className="rounded-sm border border-ui-border bg-ui-subtle/30 px-3 py-2.5">
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-ui-muted">
                          Status
                        </dt>
                        <dd className="mt-1 text-sm font-medium capitalize text-ui-text">
                          {String(detail.status || 'pending').replace(/_/g, ' ')}
                        </dd>
                      </div>
                    </dl>
                    {reason ? (
                      <div className="rounded-sm border border-ui-border bg-white px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-ui-muted">
                          Reason / remarks
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ui-text">{reason}</p>
                      </div>
                    ) : null}
                  </div>
                )}
              </Card>

              <Card {...mt} className="rounded-sm border border-ui-border p-5 shadow-sm sm:p-6">
                <ApprovalWorkflowPanel approvers={approvers} trail={trail} />
              </Card>
            </div>

            <aside className="xl:sticky xl:top-6 xl:self-start">
              <Card {...mt} className="rounded-sm border border-moh-green/20 bg-white p-5 shadow-sm">
                <Typography
                  {...mt}
                  className="text-sm font-bold uppercase tracking-wide text-moh-green"
                >
                  Your decision
                </Typography>
                <p className="mt-1 text-sm text-ui-muted">
                  {detail.can_act
                    ? 'Review the full details and approval trail, then approve or return.'
                    : 'You can view this item, but it is not awaiting your action.'}
                </p>

                {detail.can_act ? (
                  <>
                    <Textarea
                      {...mt}
                      label="Comments (optional)"
                      className="mt-4"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                    />
                    <div className="mt-4 flex flex-col gap-2">
                      <Button
                        {...mt}
                        className="rounded-sm bg-moh-green normal-case"
                        loading={actMutation.isPending}
                        onClick={() => actMutation.mutate(true)}
                      >
                        <CheckCircle2 className="mr-1.5 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        {...mt}
                        variant="outlined"
                        className="rounded-sm border-red-200 normal-case text-red-700"
                        loading={actMutation.isPending}
                        onClick={() => actMutation.mutate(false)}
                      >
                        <XCircle className="mr-1.5 h-4 w-4" />
                        {rejectLabel}
                      </Button>
                    </div>
                  </>
                ) : null}
              </Card>
            </aside>
          </div>
        )}
      </QueryState>
    </div>
  )
}

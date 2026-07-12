import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Chip,
  Tab,
  Tabs,
  TabsHeader,
  Textarea,
  Typography,
} from '@material-tailwind/react'
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Timer,
  XCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  approvalsService,
  type ApprovalInboxItem,
} from '@/api/services/approvals'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { PageHeader } from '@/components/organisms/PageHeader'
import { QueryState } from '@/components/organisms/QueryState'
import { notifyApiError, toast } from '@/features/toast'
import { useAuthStore } from '@/stores/appStore'
import { mt } from '@/utils/mt'
import { cn } from '@/utils/cn'

type FilterTab = 'all' | 'leave' | 'oos' | 'performance'

const MODULE_STYLES: Record<
  ApprovalInboxItem['module'],
  { chip: string; icon: typeof CalendarDays }
> = {
  leave: { chip: 'bg-sky-100 text-sky-800', icon: CalendarDays },
  oos: { chip: 'bg-violet-100 text-violet-800', icon: MapPin },
  performance: { chip: 'bg-amber-100 text-amber-900', icon: BarChart3 },
  ppa: { chip: 'bg-emerald-100 text-emerald-800', icon: BarChart3 },
}

function matchesFilter(item: ApprovalInboxItem, filter: FilterTab) {
  if (filter === 'all') return true
  if (filter === 'leave') return item.module === 'leave'
  if (filter === 'oos') return item.module === 'oos'
  return item.module === 'performance' || item.module === 'ppa'
}

function waitingLabel(days: number) {
  if (days <= 0) return 'Today'
  if (days === 1) return '1 day'
  return `${days} days`
}

export function ApprovalsPage() {
  const { staffId } = useAuthStore()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<FilterTab>('all')
  const [comments, setComments] = useState<Record<string, string>>({})
  const [activeId, setActiveId] = useState<string | null>(null)

  const inboxQuery = useQuery({
    queryKey: ['approvals', 'inbox'],
    queryFn: () => approvalsService.inbox(),
    enabled: Boolean(staffId),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['approvals'] })
    queryClient.invalidateQueries({ queryKey: ['leave'] })
    queryClient.invalidateQueries({ queryKey: ['oos'] })
    queryClient.invalidateQueries({ queryKey: ['performance'] })
  }

  const actMutation = useMutation({
    mutationFn: async ({
      item,
      approve,
    }: {
      item: ApprovalInboxItem
      approve: boolean
    }) => {
      const note = comments[item.id]?.trim() ?? ''
      if (item.module === 'leave' && item.approval_id) {
        return approvalsService.approveLeave(item.approval_id, { approve, comments: note })
      }
      if (item.module === 'oos' && item.approval_id) {
        return approvalsService.approveOos(item.approval_id, { approve, comments: note })
      }
      if (item.module === 'ppa' && item.ppa_id) {
        return approvalsService.reviewPpa({ ppa_id: item.ppa_id, approve, comments: note })
      }
      if (item.module === 'performance' && item.report_id) {
        return approvalsService.reviewAppraisal({
          report_id: item.report_id,
          decision: approve ? 'approve' : 'return',
          comments: note || (approve ? 'Approved' : 'Returned for revision'),
          comment_role:
            item.status === 'countersigning'
              ? 'countersigning'
              : item.status === 'responsible_review'
                ? 'responsible_officer'
                : 'appraiser',
        })
      }
      throw new Error('Unsupported approval item')
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.approve ? 'Request approved successfully.' : 'Request returned or rejected.',
      )
      setActiveId(null)
      invalidate()
    },
    onError: (error: unknown) => notifyApiError(error, 'Could not complete approval action'),
  })

  const stats = inboxQuery.data?.stats
  const filtered = useMemo(() => {
    const rows = inboxQuery.data?.pending ?? []
    return rows.filter((row) => matchesFilter(row, filter))
  }, [filter, inboxQuery.data?.pending])

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Approvals"
        subtitle="Central inbox for leave, out-of-station, performance plans, and appraisals awaiting your action"
      />

      <QueryState
        isLoading={inboxQuery.isLoading}
        isError={inboxQuery.isError}
        error={inboxQuery.error}
        label="approval inbox"
        variant="dashboard"
        onRetry={() => inboxQuery.refetch()}
      >
        {stats ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Pending approvals"
                value={stats.pending_total}
                icon={Clock3}
                accent="amber"
              />
              <MetricCard
                title="Leave"
                value={stats.leave_pending}
                icon={CalendarDays}
                accent="blue"
              />
              <MetricCard
                title="Out of station"
                value={stats.oos_pending}
                icon={MapPin}
                accent="purple"
              />
              <MetricCard
                title="Performance"
                value={stats.performance_pending + stats.ppa_pending}
                icon={BarChart3}
                accent="green"
              />
            </div>

            <Card {...mt} className="rounded-sm border border-moh-green/15 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-sm bg-moh-green/10 p-2 text-moh-green">
                    <Timer className="h-5 w-5" />
                  </div>
                  <div>
                    <Typography {...mt} className="text-sm font-bold uppercase tracking-wide text-moh-green">
                      Your approval performance
                    </Typography>
                    <p className="mt-1 text-sm text-gray-600">
                      Average time to act on requests assigned to you
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-ui-text">{stats.avg_approval_label}</p>
                  <p className="text-xs text-gray-500">
                    across {stats.completed_count.toLocaleString()} completed review
                    {stats.completed_count === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
            </Card>

            <Tabs value={filter}>
              <TabsHeader {...mt} className="rounded-sm bg-moh-background">
                <Tab {...mt} value="all" onClick={() => setFilter('all')}>
                  All ({stats.pending_total})
                </Tab>
                <Tab {...mt} value="leave" onClick={() => setFilter('leave')}>
                  Leave ({stats.leave_pending})
                </Tab>
                <Tab {...mt} value="oos" onClick={() => setFilter('oos')}>
                  Out of station ({stats.oos_pending})
                </Tab>
                <Tab {...mt} value="performance" onClick={() => setFilter('performance')}>
                  Performance ({stats.performance_pending + stats.ppa_pending})
                </Tab>
              </TabsHeader>
            </Tabs>

            <Card {...mt} className="overflow-hidden rounded-sm border border-moh-green/15 shadow-sm">
              <div className="border-b border-moh-green/10 bg-gradient-to-r from-moh-background via-white to-moh-background/40 px-4 py-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-moh-green">
                  Pending approvals
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  {filtered.length} item{filtered.length === 1 ? '' : 's'} requiring your attention
                </p>
              </div>

              {filtered.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-moh-green/50" />
                  <p className="mt-3 text-sm font-medium text-ui-text">You are all caught up</p>
                  <p className="mt-1 text-sm text-gray-500">
                    No pending approvals in this category right now.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filtered.map((item) => {
                    const style = MODULE_STYLES[item.module]
                    const isOpen = activeId === item.id
                    return (
                      <div key={item.id} className="px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Chip
                                {...mt}
                                size="sm"
                                value={item.type_label}
                                className={cn('normal-case', style.chip)}
                              />
                              {item.stage_name ? (
                                <span className="text-xs font-medium uppercase tracking-wide text-moh-green">
                                  {item.stage_name}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-base font-semibold text-ui-text">{item.staff_name}</p>
                            <p className="text-sm font-medium text-gray-700">{item.title}</p>
                            <p className="mt-1 text-sm text-gray-500">{item.subtitle}</p>
                            {typeof item.meta?.reason === 'string' && item.meta.reason ? (
                              <p className="mt-2 text-sm text-ui-text">
                                <span className="font-medium">Reason:</span> {item.meta.reason}
                              </p>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <p className="text-xs uppercase tracking-wide text-gray-500">Waiting</p>
                            <p className="text-sm font-semibold text-ui-text">
                              {waitingLabel(item.waiting_days)}
                            </p>
                          </div>
                        </div>

                        {item.can_act ? (
                          <div className="mt-4 rounded-sm border border-gray-100 bg-gray-50/80 p-3">
                            {item.module === 'performance' ? (
                              <p className="mb-2 text-xs text-gray-600">
                                Full appraisal details are on the Performance page. You can approve or
                                return from here, or{' '}
                                <Link to="/performance" className="font-medium text-moh-green hover:underline">
                                  open Performance
                                </Link>{' '}
                                for the full review form.
                              </p>
                            ) : null}
                            <Textarea
                              {...mt}
                              label="Comments (optional)"
                              value={comments[item.id] ?? ''}
                              onChange={(e) =>
                                setComments((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                            />
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                {...mt}
                                size="sm"
                                className="rounded-sm bg-moh-green"
                                loading={actMutation.isPending && isOpen}
                                onClick={() => {
                                  setActiveId(item.id)
                                  actMutation.mutate({ item, approve: true })
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                {...mt}
                                size="sm"
                                variant="outlined"
                                className="rounded-sm border-red-200 text-red-700"
                                loading={actMutation.isPending && isOpen}
                                onClick={() => {
                                  setActiveId(item.id)
                                  actMutation.mutate({ item, approve: false })
                                }}
                              >
                                {item.module === 'performance' || item.module === 'ppa' ? (
                                  <>
                                    <XCircle className="mr-1 h-4 w-4" />
                                    Return
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="mr-1 h-4 w-4" />
                                    Reject
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </>
        ) : null}
      </QueryState>
    </div>
  )
}

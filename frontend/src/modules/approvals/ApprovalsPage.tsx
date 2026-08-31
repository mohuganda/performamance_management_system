import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Chip, Tab, Tabs, TabsHeader, Typography } from '@material-tailwind/react'
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  History,
  MapPin,
  Timer,
} from 'lucide-react'
import {
  approvalsService,
  type ApprovalInboxItem,
} from '@/api/services/approvals'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { PageHeader } from '@/components/organisms/PageHeader'
import { QueryState } from '@/components/organisms/QueryState'
import { useAuthStore } from '@/stores/appStore'
import { mt } from '@/utils/mt'
import { cn } from '@/utils/cn'

type ViewTab = 'pending' | 'history'
type FilterTab = 'all' | 'leave' | 'oos' | 'performance'

const MODULE_STYLES: Record<
  ApprovalInboxItem['module'],
  { chip: string; iconBg: string; icon: typeof CalendarDays }
> = {
  leave: {
    chip: 'bg-sky-100 text-sky-800',
    iconBg: 'bg-sky-50 text-sky-700',
    icon: CalendarDays,
  },
  oos: {
    chip: 'bg-violet-100 text-violet-800',
    iconBg: 'bg-violet-50 text-violet-700',
    icon: MapPin,
  },
  performance: {
    chip: 'bg-amber-100 text-amber-900',
    iconBg: 'bg-amber-50 text-amber-900',
    icon: BarChart3,
  },
  ppa: {
    chip: 'bg-emerald-100 text-emerald-800',
    iconBg: 'bg-emerald-50 text-emerald-800',
    icon: BarChart3,
  },
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

function formatSubmitted(iso?: string) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function statusTone(status: string) {
  const key = status.toLowerCase()
  if (key === 'approved' || key === 'countersigned' || key === 'responsible_approved') {
    return 'bg-emerald-100 text-emerald-800'
  }
  if (key === 'rejected' || key === 'returned') {
    return 'bg-rose-100 text-rose-800'
  }
  return 'bg-gray-100 text-gray-700'
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ')
}

export function approvalDetailPath(item: ApprovalInboxItem): string | null {
  if (item.module === 'leave' && item.approval_id) {
    return `/approvals/leave/${item.approval_id}`
  }
  if (item.module === 'oos' && item.approval_id) {
    return `/approvals/oos/${item.approval_id}`
  }
  if (item.module === 'ppa' && item.ppa_id) {
    return `/approvals/ppa/${item.ppa_id}`
  }
  if (item.module === 'performance' && item.report_id) {
    return `/approvals/performance/${item.report_id}`
  }
  return null
}

export function ApprovalsPage() {
  const { staffId } = useAuthStore()
  const [view, setView] = useState<ViewTab>('pending')
  const [filter, setFilter] = useState<FilterTab>('all')

  const inboxQuery = useQuery({
    queryKey: ['approvals', 'inbox'],
    queryFn: () => approvalsService.inbox(),
    enabled: Boolean(staffId),
  })

  const stats = inboxQuery.data?.stats
  const sourceRows = view === 'pending' ? (inboxQuery.data?.pending ?? []) : (inboxQuery.data?.history ?? [])

  const filtered = useMemo(() => {
    return sourceRows.filter((row) => matchesFilter(row, filter))
  }, [filter, sourceRows])

  const moduleCounts = useMemo(() => {
    const rows = sourceRows
    return {
      all: rows.length,
      leave: rows.filter((r) => r.module === 'leave').length,
      oos: rows.filter((r) => r.module === 'oos').length,
      performance: rows.filter((r) => r.module === 'performance' || r.module === 'ppa').length,
    }
  }, [sourceRows])

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Approvals"
        subtitle="Review pending requests, or browse items you have already decided"
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
                title="My decisions"
                value={stats.history_count ?? stats.completed_count}
                icon={History}
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
                    <Typography
                      {...mt}
                      className="text-sm font-bold uppercase tracking-wide text-moh-green"
                    >
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

            <Tabs value={view}>
              <TabsHeader {...mt} className="rounded-sm bg-moh-background">
                <Tab
                  {...mt}
                  value="pending"
                  onClick={() => {
                    setView('pending')
                    setFilter('all')
                  }}
                >
                  Pending approvals ({stats.pending_total})
                </Tab>
                <Tab
                  {...mt}
                  value="history"
                  onClick={() => {
                    setView('history')
                    setFilter('all')
                  }}
                >
                  My decisions ({stats.history_count ?? stats.completed_count})
                </Tab>
              </TabsHeader>
            </Tabs>

            <Tabs value={filter}>
              <TabsHeader {...mt} className="rounded-sm bg-moh-background">
                <Tab {...mt} value="all" onClick={() => setFilter('all')}>
                  All ({moduleCounts.all})
                </Tab>
                <Tab {...mt} value="leave" onClick={() => setFilter('leave')}>
                  Leave ({moduleCounts.leave})
                </Tab>
                <Tab {...mt} value="oos" onClick={() => setFilter('oos')}>
                  Out of station ({moduleCounts.oos})
                </Tab>
                <Tab {...mt} value="performance" onClick={() => setFilter('performance')}>
                  Performance ({moduleCounts.performance})
                </Tab>
              </TabsHeader>
            </Tabs>

            <Card {...mt} className="overflow-hidden rounded-sm border border-moh-green/15 shadow-sm">
              <div className="border-b border-moh-green/10 bg-gradient-to-r from-moh-background via-white to-moh-background/40 px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-moh-green">
                      {view === 'pending' ? 'Pending approvals' : 'My decisions'}
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {filtered.length} item{filtered.length === 1 ? '' : 's'}
                      {view === 'pending'
                        ? ' · open any row to review full details'
                        : ' · leave, OOS, PPA, and performance items you have approved or returned'}
                    </p>
                  </div>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-moh-green/50" />
                  <p className="mt-3 text-sm font-medium text-ui-text">
                    {view === 'pending' ? 'You are all caught up' : 'No decisions yet'}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {view === 'pending'
                      ? 'No pending approvals in this category right now.'
                      : 'Items you approve or return will appear here.'}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filtered.map((item) => {
                    const style = MODULE_STYLES[item.module]
                    const Icon = style.icon
                    const href = approvalDetailPath(item)
                    const urgent = view === 'pending' && item.waiting_days >= 3
                    const submitted = formatSubmitted(item.submitted_at)
                    const acted = formatSubmitted(item.acted_at)

                    return (
                      <li
                        key={item.id}
                        className={cn(
                          'flex items-stretch gap-3 px-4 py-4 sm:gap-4 sm:px-5',
                          urgent && 'bg-amber-50/40',
                        )}
                      >
                        <div
                          className={cn(
                            'mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-sm',
                            style.iconBg,
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Chip
                              {...mt}
                              size="sm"
                              value={item.type_label}
                              className={cn('normal-case', style.chip)}
                            />
                            {view === 'history' ? (
                              <Chip
                                {...mt}
                                size="sm"
                                value={statusLabel(item.status)}
                                className={cn('normal-case capitalize', statusTone(item.status))}
                              />
                            ) : null}
                            {item.stage_name ? (
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-moh-green">
                                {item.stage_name}
                              </span>
                            ) : null}
                            {urgent ? (
                              <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                                Overdue attention
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-2 truncate text-base font-semibold text-ui-text">
                            {item.staff_name}
                          </p>
                          <p className="mt-0.5 truncate text-sm font-medium text-gray-800">
                            {item.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-sm text-ui-muted">{item.subtitle}</p>
                          {typeof item.meta?.reason === 'string' && item.meta.reason ? (
                            <p className="mt-1.5 line-clamp-1 text-sm text-gray-700">
                              <span className="font-medium text-ui-text">Reason:</span>{' '}
                              {item.meta.reason}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 flex-col items-end justify-between gap-3 self-stretch">
                          <div className="text-right">
                            {view === 'pending' ? (
                              <>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-ui-muted">
                                  Waiting
                                </p>
                                <p
                                  className={cn(
                                    'mt-0.5 text-sm font-semibold',
                                    urgent ? 'text-amber-900' : 'text-ui-text',
                                  )}
                                >
                                  {waitingLabel(item.waiting_days)}
                                </p>
                                {submitted ? (
                                  <p className="mt-0.5 text-xs text-ui-muted">{submitted}</p>
                                ) : null}
                              </>
                            ) : (
                              <>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-ui-muted">
                                  Decided
                                </p>
                                <p className="mt-0.5 text-sm font-semibold text-ui-text">
                                  {acted ?? '—'}
                                </p>
                                {submitted ? (
                                  <p className="mt-0.5 text-xs text-ui-muted">Submitted {submitted}</p>
                                ) : null}
                              </>
                            )}
                          </div>
                          {href ? (
                            <Link to={href}>
                              <Button
                                {...mt}
                                size="sm"
                                className={cn(
                                  'flex items-center gap-1.5 rounded-sm normal-case',
                                  view === 'pending'
                                    ? 'bg-moh-green'
                                    : 'border border-moh-green/30 bg-white text-moh-green shadow-none',
                                )}
                                variant={view === 'pending' ? 'filled' : 'outlined'}
                              >
                                {view === 'pending' ? 'Review' : 'View'}
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </Link>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          </>
        ) : null}
      </QueryState>
    </div>
  )
}

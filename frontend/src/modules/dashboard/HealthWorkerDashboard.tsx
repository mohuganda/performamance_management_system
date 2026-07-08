import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Highcharts from 'highcharts'
import { HighchartsReact } from 'highcharts-react-official'
import { Award, Clock, MapPin, Target } from 'lucide-react'
import { dashboardService } from '@/api/services/pms'
import { AttendanceIntegrationBanner } from '@/components/dashboard/AttendanceIntegrationBanner'
import { DashboardDrilldownPanel, useDashboardDrilldown } from '@/components/dashboard/DashboardDrilldownPanel'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { DashboardHeader } from '@/components/organisms/DashboardHeader'
import { ModuleQuickLinks } from '@/components/organisms/ModuleQuickLinks'
import { QueryState } from '@/components/organisms/QueryState'
import { useAuthStore } from '@/stores/appStore'
import { ProgressBar } from '@/components/molecules/ProgressBar'
import { Card } from '@/components/atoms/Card'
import { buildHealthWorkerDrilldowns } from '@/utils/dashboardDrilldown'
import type { AttendanceIntegration, DashboardAnalytics, PersonalAttendanceRow } from '@/types/dashboard'

export function HealthWorkerDashboard() {
  const { displayName, quarter, staffId } = useAuthStore()
  const { activeId, openDrilldown, closeDrilldown, panelRef } = useDashboardDrilldown('task_completion')
  const { data, isLoading, isError, error, refetch, isPending } = useQuery({
    queryKey: ['dashboard', 'health-worker', quarter, staffId],
    queryFn: () => dashboardService.healthWorker(staffId ?? 1, quarter),
  })

  const analytics = data as DashboardAnalytics & Record<string, unknown>
  const integration = analytics?.attendance_integration as AttendanceIntegration | undefined
  const attendanceRows = (analytics?.attendance_summary ?? analytics?.personal_attendance ?? []) as PersonalAttendanceRow[]
  const latest = attendanceRows[attendanceRows.length - 1]
  const taskCompletion = (data?.task_completion ?? {}) as { percent?: number; completed?: number; total?: number }
  const immediateFocus = (data?.immediate_focus ?? {}) as {
    tasks_due_this_week?: Array<{ task: string; status: string }>
    upcoming_deadlines?: Array<{ task: string; days_remaining: number }>
  }
  const quarterlyTasks = (data?.quarterly_tasks ?? []) as Array<Record<string, string>>
  const notifications = (data?.notifications ?? []) as Array<{ type: string; message: string }>
  const overallPerf = (data?.overall_performance ?? {}) as {
    normalized_score?: number
    raw_score?: number
    latest_score?: number
    ppa_status?: string
  }

  const drilldowns = useMemo(
    () =>
      buildHealthWorkerDrilldowns(
        attendanceRows,
        quarterlyTasks,
        immediateFocus.tasks_due_this_week ?? [],
        immediateFocus.upcoming_deadlines ?? [],
      ),
    [attendanceRows, quarterlyTasks, immediateFocus.tasks_due_this_week, immediateFocus.upcoming_deadlines],
  )

  const chartOptions: Highcharts.Options = {
    chart: { backgroundColor: 'transparent', height: 260 },
    credits: { enabled: false },
    title: { text: undefined },
    xAxis: { categories: attendanceRows.map((r) => r.month) },
    yAxis: { min: 70, max: 100, title: { text: '%' } },
    tooltip: { shared: true, valueSuffix: '%' },
    series: [
      { type: 'column', name: 'HRM duty summary', data: attendanceRows.map((r) => r.hrm_summary_percent), color: '#1565C0' },
      { type: 'column', name: 'PMS out-of-station', data: attendanceRows.map((r) => r.oos_attendance_percent), color: '#F9A825' },
      { type: 'spline', name: 'Combined', data: attendanceRows.map((r) => r.combined_percent), color: '#2E7D32', lineWidth: 2 },
    ],
  }

  return (
    <QueryState
      isLoading={isLoading}
      isPending={isPending}
      isError={isError}
      error={error}
      label="dashboard"
      variant="dashboard"
      onRetry={() => refetch()}
    >
      {data ? (
        <div className="space-y-6 p-4 md:p-6">
          <ModuleQuickLinks />
          <DashboardHeader
            title="Performance Management System (PMS - iHRIS)"
            welcome={`Welcome, ${displayName} - Health Worker`}
            context="Your personal performance workspace"
            quarter={quarter}
          />

          {integration ? <AttendanceIntegrationBanner data={integration} /> : null}

          {latest ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Overall performance"
                value={
                  (overallPerf.normalized_score ?? 0) > 0
                    ? `${overallPerf.normalized_score}%`
                    : '—'
                }
                hint={
                  (overallPerf.normalized_score ?? 0) > 0
                    ? `Raw avg ${overallPerf.raw_score ?? 0} · PPA ${String(overallPerf.ppa_status ?? '—').replace(/_/g, ' ')}`
                    : 'File reports to generate your score'
                }
                icon={Award}
                accent={
                  (overallPerf.normalized_score ?? 0) >= 80
                    ? 'green'
                    : (overallPerf.normalized_score ?? 0) >= 60
                      ? 'amber'
                      : 'green'
                }
                onClick={() => openDrilldown('task_completion')}
                active={activeId === 'task_completion'}
              />
              <MetricCard
                title="Combined attendance"
                value={`${latest.combined_percent}%`}
                hint={`Target ${latest.target}%`}
                icon={Target}
                accent={latest.combined_percent >= latest.target ? 'green' : 'amber'}
                onClick={() => openDrilldown('combined_attendance')}
                active={activeId === 'combined_attendance'}
              />
              <MetricCard
                title="Out-of-station (PMS)"
                value={`${latest.oos_attendance_percent}%`}
                hint={`${latest.oos_clock_events ?? 0} GPS clock events`}
                icon={MapPin}
                accent="blue"
                onClick={() => openDrilldown('oos_attendance')}
                active={activeId === 'oos_attendance'}
              />
              <MetricCard
                title="Duty station (HRM)"
                value={`${latest.hrm_summary_percent}%`}
                hint="From HRM Attend summaries"
                icon={Clock}
                accent="purple"
                onClick={() => openDrilldown('hrm_attendance')}
                active={activeId === 'hrm_attendance'}
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Overall performance"
                value={
                  (overallPerf.normalized_score ?? 0) > 0
                    ? `${overallPerf.normalized_score}%`
                    : '—'
                }
                hint={
                  (overallPerf.normalized_score ?? 0) > 0
                    ? `Raw avg ${overallPerf.raw_score ?? 0}`
                    : 'File reports to generate your score'
                }
                icon={Award}
                accent="green"
              />
            </div>
          )}

          <Card>
            <ProgressBar
              value={taskCompletion.percent ?? 0}
              label="Task Completion"
              sublabel={`${taskCompletion.completed ?? 0} of ${taskCompletion.total ?? 0} tasks completed`}
              onClick={() => openDrilldown('task_completion')}
              active={activeId === 'task_completion'}
            />
          </Card>

          {attendanceRows.length > 0 ? (
            <Card>
              <h2 className="mb-4 text-sm font-bold uppercase text-moh-green">My attendance record</h2>
              <HighchartsReact highcharts={Highcharts} options={chartOptions} />
            </Card>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Card
              role="button"
              tabIndex={0}
              className={`cursor-pointer p-4 transition hover:shadow-md hover:ring-2 hover:ring-moh-green/25 ${activeId === 'tasks_due' ? 'ring-2 ring-moh-green shadow-md' : ''}`}
              onClick={() => openDrilldown('tasks_due')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openDrilldown('tasks_due')
                }
              }}
            >
              <h2 className="mb-3 text-sm font-bold uppercase text-moh-green">Tasks Due This Week</h2>
              <p className="text-2xl font-bold text-ui-text">
                {(immediateFocus.tasks_due_this_week ?? []).length}
              </p>
              <p className="mt-1 text-xs text-moh-green">View details →</p>
            </Card>
            <Card
              role="button"
              tabIndex={0}
              className={`cursor-pointer p-4 transition hover:shadow-md hover:ring-2 hover:ring-moh-green/25 ${activeId === 'deadlines' ? 'ring-2 ring-moh-green shadow-md' : ''}`}
              onClick={() => openDrilldown('deadlines')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openDrilldown('deadlines')
                }
              }}
            >
              <h2 className="mb-3 text-sm font-bold uppercase text-moh-green">Upcoming Deadlines (7 Days)</h2>
              <p className="text-2xl font-bold text-ui-text">
                {(immediateFocus.upcoming_deadlines ?? []).length}
              </p>
              <p className="mt-1 text-xs text-moh-green">View details →</p>
            </Card>
          </div>

          <DashboardDrilldownPanel
            drilldowns={drilldowns}
            activeId={activeId}
            onClose={closeDrilldown}
            panelRef={panelRef}
          />

          <Card>
            <h2 className="mb-3 text-sm font-bold uppercase text-moh-green">Notifications & Alerts</h2>
            <ul className="space-y-2 text-sm">
              {notifications.map((item) => (
                <li
                  key={item.message}
                  className={
                    item.type === 'error'
                      ? 'text-moh-error'
                      : item.type === 'warning'
                        ? 'text-moh-warning'
                        : 'text-moh-success'
                  }
                >
                  {item.message}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : (
        <Card className="m-4 md:m-6">
          <p className="text-sm text-gray-600">No dashboard data returned. Try refreshing the page.</p>
        </Card>
      )}
    </QueryState>
  )
}

import { useQuery } from '@tanstack/react-query'
import Highcharts from 'highcharts'
import { HighchartsReact } from 'highcharts-react-official'
import { Clock, MapPin, Target } from 'lucide-react'
import { dashboardService } from '@/api/services/pms'
import { AttendanceIntegrationBanner } from '@/components/dashboard/AttendanceIntegrationBanner'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { DashboardHeader } from '@/components/organisms/DashboardHeader'
import { ModuleQuickLinks } from '@/components/organisms/ModuleQuickLinks'
import { QueryState } from '@/components/organisms/QueryState'
import { useAuthStore } from '@/stores/appStore'
import { DataTable } from '@/components/organisms/DataTable'
import { ProgressBar } from '@/components/molecules/ProgressBar'
import { Card } from '@/components/atoms/Card'
import type { AttendanceIntegration, DashboardAnalytics, PersonalAttendanceRow } from '@/types/dashboard'

export function HealthWorkerDashboard() {
  const { displayName, quarter, staffId } = useAuthStore()
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
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard
                title="Combined attendance"
                value={`${latest.combined_percent}%`}
                hint={`Target ${latest.target}%`}
                icon={Target}
                accent={latest.combined_percent >= latest.target ? 'green' : 'amber'}
              />
              <MetricCard
                title="Out-of-station (PMS)"
                value={`${latest.oos_attendance_percent}%`}
                hint={`${latest.oos_clock_events ?? 0} GPS clock events`}
                icon={MapPin}
                accent="blue"
              />
              <MetricCard
                title="Duty station (HRM)"
                value={`${latest.hrm_summary_percent}%`}
                hint="From HRM Attend summaries"
                icon={Clock}
                accent="purple"
              />
            </div>
          ) : null}

          <Card>
            <ProgressBar
              value={taskCompletion.percent ?? 0}
              label="Task Completion"
              sublabel={`${taskCompletion.completed ?? 0} of ${taskCompletion.total ?? 0} tasks completed`}
            />
          </Card>

          {attendanceRows.length > 0 ? (
            <Card>
              <h2 className="mb-4 text-sm font-bold uppercase text-moh-green">My attendance record</h2>
              <HighchartsReact highcharts={Highcharts} options={chartOptions} />
            </Card>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-sm font-bold uppercase text-moh-green">Tasks Due This Week</h2>
              <ul className="space-y-2 text-sm">
                {(immediateFocus.tasks_due_this_week ?? []).map(
                  (item) => (
                    <li key={item.task} className="flex justify-between border-b border-gray-100 py-2">
                      <span>{item.task}</span>
                      <span className="font-semibold text-moh-warning">{item.status}</span>
                    </li>
                  ),
                )}
              </ul>
            </Card>
            <Card>
              <h2 className="mb-3 text-sm font-bold uppercase text-moh-green">Upcoming Deadlines (7 Days)</h2>
              <ul className="space-y-2 text-sm">
                {(immediateFocus.upcoming_deadlines ?? []).map(
                  (item) => (
                    <li key={item.task} className="flex justify-between border-b border-gray-100 py-2">
                      <span>{item.task}</span>
                      <span className="text-moh-warning">{item.days_remaining} days</span>
                    </li>
                  ),
                )}
              </ul>
            </Card>
          </div>

          {attendanceRows.length > 0 ? (
            <DataTable
              title="Attendance breakdown"
              columns={['Month', 'HRM summary', 'PMS OOS', 'Combined', 'Status']}
              rows={attendanceRows.map((row) => ({
                Month: row.month,
                'HRM summary': `${row.hrm_summary_percent}%`,
                'PMS OOS': `${row.oos_attendance_percent}%`,
                Combined: `${row.combined_percent}%`,
                Status: row.status.replace('_', ' '),
              }))}
            />
          ) : null}

          <DataTable
            title="Quarterly Task Breakdown"
            columns={['ID', 'Task Description', 'Due Date', 'Status', 'Action']}
            rows={quarterlyTasks.map((task) => ({
              ID: task.id,
              'Task Description': task.description,
              'Due Date': task.due_date,
              Status: task.status,
              Action: task.action,
            }))}
          />

          <Card>
            <h2 className="mb-3 text-sm font-bold uppercase text-moh-green">Notifications & Alerts</h2>
            <ul className="space-y-2 text-sm">
              {(notifications).map((item) => (
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

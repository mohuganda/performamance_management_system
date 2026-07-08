import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Highcharts from 'highcharts'
import { HighchartsReact } from 'highcharts-react-official'
import { AlertTriangle, CheckCircle2, TrendingUp, Users } from 'lucide-react'
import { dashboardService } from '@/api/services/pms'
import { AttendanceIntegrationBanner } from '@/components/dashboard/AttendanceIntegrationBanner'
import { AttendanceTrendChart } from '@/components/dashboard/AttendanceTrendChart'
import { DashboardDrilldownPanel, useDashboardDrilldown } from '@/components/dashboard/DashboardDrilldownPanel'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { DashboardHeader } from '@/components/organisms/DashboardHeader'
import { ProgressBar } from '@/components/molecules/ProgressBar'
import { Card } from '@/components/atoms/Card'
import { QueryState } from '@/components/organisms/QueryState'
import { useAuthStore } from '@/stores/appStore'
import { buildDepartmentDrilldowns } from '@/utils/dashboardDrilldown'
import type { AttendanceIntegration, AttendanceTrends, DashboardAnalytics, OrgContext } from '@/types/dashboard'

export function DepartmentHeadDashboard() {
  const { displayName, quarter } = useAuthStore()
  const { activeId, openDrilldown, closeDrilldown, panelRef } = useDashboardDrilldown('total_teams')
  const { data, isLoading, isError, error, refetch, isPending } = useQuery({
    queryKey: ['dashboard', 'department-head', quarter],
    queryFn: () => dashboardService.departmentHead(quarter),
  })

  const analytics = data as DashboardAnalytics & Record<string, unknown>
  const integration = analytics?.attendance_integration as AttendanceIntegration | undefined
  const orgContext = (data?.org_context ?? {}) as OrgContext
  const taskLabel = (data?.task_completion_label as string) ?? 'Department task completion'
  const trends = analytics?.attendance_trends as AttendanceTrends | undefined
  const taskCompletion = (data?.task_completion ?? {}) as {
    percent?: number
    on_track?: number
    total?: number
  }
  const summaryCards = (data?.summary_cards ?? {}) as Record<string, number>
  const teamPerformance = (data?.team_performance ?? []) as Array<Record<string, string | number>>
  const interventions = (data?.intervention_required ?? []) as Array<Record<string, unknown>>
  const trendQuarters =
    (data?.trends as { quarters?: Array<{ label: string; value: number }> } | undefined)?.quarters ??
    []
  const trendMeta = (data?.trends ?? {}) as { target?: number; actual?: number }

  const drilldowns = useMemo(
    () => buildDepartmentDrilldowns(teamPerformance, interventions),
    [teamPerformance, interventions],
  )

  const trendOptions: Highcharts.Options = {
    chart: { type: 'column', backgroundColor: 'transparent', height: 280 },
    credits: { enabled: false },
    title: { text: undefined },
    xAxis: {
      categories: trendQuarters.map((q) => q.label),
    },
    yAxis: { min: 50, max: 100, title: { text: 'Task completion %' } },
    legend: { enabled: false },
    series: [
      {
        type: 'column',
        name: 'Completion',
        data: trendQuarters.map((q) => q.value),
        color: '#2E7D32',
      },
    ],
  }

  return (
    <QueryState
      isLoading={isLoading}
      isPending={isPending}
      isError={isError}
      error={error}
      label="department dashboard"
      variant="dashboard"
      onRetry={() => refetch()}
    >
      {data ? (
        <div className="space-y-6 p-4 md:p-6">
          <DashboardHeader
            title="Performance Management System"
            welcome={`Welcome, ${displayName} - Department Head`}
            context={orgContext.display_context ?? 'Department'}
            quarter={quarter}
          />

          {orgContext.breadcrumb?.length ? (
            <p className="-mt-4 text-xs text-gray-500">
              iHRIS: {orgContext.breadcrumb.join(' › ')}
            </p>
          ) : null}

          {integration ? <AttendanceIntegrationBanner data={integration} /> : null}

          <Card>
            <ProgressBar
              value={taskCompletion.percent ?? 0}
              label={taskLabel}
              sublabel={`${taskCompletion.on_track ?? 0} of ${taskCompletion.total ?? 0} teams on track`}
              onClick={() => openDrilldown('task_completion')}
              active={activeId === 'task_completion'}
            />
          </Card>

          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              title="Total teams"
              value={summaryCards.total_teams ?? 0}
              hint={`${summaryCards.total_staff ?? 0} staff`}
              icon={Users}
              onClick={() => openDrilldown('total_teams')}
              active={activeId === 'total_teams'}
            />
            <MetricCard
              title="On track"
              value={summaryCards.on_track ?? 0}
              icon={CheckCircle2}
              accent="green"
              onClick={() => openDrilldown('on_track')}
              active={activeId === 'on_track'}
            />
            <MetricCard
              title="At risk"
              value={summaryCards.at_risk ?? 0}
              icon={TrendingUp}
              accent="amber"
              onClick={() => openDrilldown('at_risk')}
              active={activeId === 'at_risk'}
            />
            <MetricCard
              title="Off track"
              value={summaryCards.off_track ?? 0}
              icon={AlertTriangle}
              accent="red"
              onClick={() => openDrilldown('off_track')}
              active={activeId === 'off_track'}
            />
          </div>

          {trends ? (
            <AttendanceTrendChart
              trends={trends}
              title="Department attendance — HRM summaries + PMS out-of-station"
            />
          ) : null}

          {interventions.length > 0 ? (
            <Card className="p-4">
              <button
                type="button"
                className="text-left text-sm font-bold uppercase text-moh-green hover:underline"
                onClick={() => openDrilldown('interventions')}
              >
                {interventions.length} intervention(s) required — view detail →
              </button>
            </Card>
          ) : null}

          <DashboardDrilldownPanel
            drilldowns={drilldowns}
            activeId={activeId}
            onClose={closeDrilldown}
            panelRef={panelRef}
          />

          <Card>
            <h2 className="mb-4 text-sm font-bold uppercase text-moh-green">Department Trends (Last 3 Quarters)</h2>
            <HighchartsReact highcharts={Highcharts} options={trendOptions} />
            <p className="mt-2 text-sm text-gray-600">
              Target: {trendMeta.target ?? 0}% | Actual: {trendMeta.actual ?? 0}%
            </p>
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

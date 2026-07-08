import { useQuery } from '@tanstack/react-query'
import Highcharts from 'highcharts'
import { HighchartsReact } from 'highcharts-react-official'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  MapPinned,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'
import { dashboardService } from '@/api/services/pms'
import { AttendanceIntegrationBanner } from '@/components/dashboard/AttendanceIntegrationBanner'
import { AttendanceTrendChart } from '@/components/dashboard/AttendanceTrendChart'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { UgandaDistrictMap } from '@/components/dashboard/UgandaDistrictMap'
import { DashboardErrorBoundary } from '@/components/organisms/DashboardErrorBoundary'
import { DashboardHeader } from '@/components/organisms/DashboardHeader'
import { DataTable } from '@/components/organisms/DataTable'
import { ProgressBar } from '@/components/molecules/ProgressBar'
import { Card } from '@/components/atoms/Card'
import { QueryState } from '@/components/organisms/QueryState'
import { useAuthStore } from '@/stores/appStore'
import type {
  AttendanceIntegration,
  AttendancePerformance,
  AttendanceTrends,
  DashboardAnalytics,
  DistrictCoverage,
  OrgContext,
} from '@/types/dashboard'

export function HRManagerDashboard() {
  const { displayName, quarter, role } = useAuthStore()
  const { data, isLoading, isError, error, refetch, isPending } = useQuery({
    queryKey: ['dashboard', 'hr-manager', quarter],
    queryFn: () => dashboardService.hrManager(quarter),
  })

  const analytics = data as DashboardAnalytics & Record<string, unknown>
  const integration = analytics?.attendance_integration as AttendanceIntegration | undefined
  const performance = analytics?.attendance_performance as AttendancePerformance | undefined
  const trends = analytics?.attendance_trends as AttendanceTrends | undefined
  const districts = (analytics?.district_coverage ?? []) as DistrictCoverage[]

  const roleLabel =
    role === 'admin'
      ? 'Administrator'
      : role === 'director'
        ? 'Director'
        : role === 'executive'
          ? 'Executive'
          : 'HR Manager'

  const orgContext = (data?.org_context ?? {}) as OrgContext
  const taskLabel = (data?.task_completion_label as string) ?? 'National task completion'

  const taskCompletion = (data?.task_completion ?? {}) as {
    percent?: number
    on_track?: number
    total?: number
  }
  const summaryCards = (data?.summary_cards ?? {}) as Record<string, number>
  const pipAnalytics = (data?.pip_analytics ?? {}) as {
    by_level?: Array<{ level: string; count: number }>
    completion_rate?: number
    avg_resolution_days?: number
  }

  const pipOptions: Highcharts.Options = {
    chart: { type: 'bar', backgroundColor: 'transparent', height: 240 },
    credits: { enabled: false },
    title: { text: undefined },
    xAxis: {
      categories: (pipAnalytics.by_level ?? []).map((r) => r.level),
    },
    yAxis: { title: { text: 'Count' } },
    legend: { enabled: false },
    series: [
      {
        type: 'bar',
        name: 'PIPs',
        data: (pipAnalytics.by_level ?? []).map((r) => r.count),
        color: '#F9A825',
      },
    ],
  }

  return (
    <QueryState
      isLoading={isLoading}
      isPending={isPending}
      isError={isError}
      error={error}
      label="HR dashboard"
      onRetry={() => refetch()}
    >
      {data ? (
        <div className="space-y-6 p-4 md:p-6">
          <DashboardHeader
            title="Performance Management System"
            welcome={`Welcome, ${displayName} — ${roleLabel}`}
            context={orgContext.display_context ?? 'Ministry of Health Uganda'}
            quarter={quarter}
          />

          {orgContext.breadcrumb?.length ? (
            <p className="-mt-4 text-xs text-gray-500">
              iHRIS: {orgContext.breadcrumb.join(' › ')}
            </p>
          ) : null}

          {integration ? <AttendanceIntegrationBanner data={integration} /> : null}

          {performance ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Combined attendance"
                value={`${performance.overall_combined}%`}
                hint={`Target ${performance.target}%`}
                icon={Target}
                accent={performance.overall_combined >= performance.target ? 'green' : 'amber'}
              />
              <MetricCard
                title="OOS GPS compliance"
                value={`${performance.oos_compliance}%`}
                hint="PMS out-of-station clocks"
                icon={MapPinned}
                accent="blue"
              />
              <MetricCard
                title="Districts on PMS"
                value={performance.districts_on_system}
                hint="Active district coverage"
                icon={Building2}
                accent="purple"
              />
              <MetricCard
                title="Staff tracked"
                value={(performance.staff_tracked ?? 0).toLocaleString()}
                hint="Across integrated records"
                icon={Users}
                accent="green"
              />
            </div>
          ) : null}

          <Card>
            <ProgressBar
              value={taskCompletion.percent ?? 0}
              label={taskLabel}
              sublabel={`${taskCompletion.on_track ?? 0} of ${taskCompletion.total ?? 0} facilities on track`}
            />
          </Card>

          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              title="Facilities"
              value={summaryCards.total_facilities ?? 0}
              hint={`${summaryCards.total_staff ?? 0} staff`}
              icon={Building2}
            />
            <MetricCard
              title="On track"
              value={summaryCards.on_track ?? 0}
              icon={CheckCircle2}
              accent="green"
            />
            <MetricCard
              title="At risk"
              value={summaryCards.at_risk ?? 0}
              icon={TrendingUp}
              accent="amber"
            />
            <MetricCard
              title="Off track"
              value={summaryCards.off_track ?? 0}
              icon={AlertTriangle}
              accent="red"
            />
          </div>

          {trends ? <AttendanceTrendChart trends={trends} /> : null}

          {districts.length > 0 ? (
            <DashboardErrorBoundary label="District map">
              <UgandaDistrictMap districts={districts} />
            </DashboardErrorBoundary>
          ) : null}

          <DataTable
            title="Facility performance (iHRIS)"
            columns={['Facility', 'Institution type', 'District', 'Staff', 'Depts', 'Task %', 'Attendance', 'PIPs']}
            rows={(
              (data.facility_performance as Array<Record<string, string | number>>) ??
              (data.institution_performance as Array<Record<string, string | number>>) ??
              []
            ).map((row) => ({
              Facility: row.facility ?? row.institution,
              'Institution type': row.institution_type ?? '—',
              District: row.district ?? '—',
              Staff: row.staff,
              Depts: row.departments ?? '—',
              'Task %': `${row.avg_task_percent}%`,
              Attendance: `${row.attendance}%`,
              PIPs: row.active_pips,
            }))}
          />

          <Card>
            <h2 className="mb-4 text-sm font-bold uppercase text-moh-green">National PIP dashboard</h2>
            <HighchartsReact highcharts={Highcharts} options={pipOptions} />
            <p className="mt-2 text-sm text-gray-600">
              PIP Completion Rate: {pipAnalytics.completion_rate ?? 0}% | Avg Resolution:{' '}
              {pipAnalytics.avg_resolution_days ?? 0} days
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

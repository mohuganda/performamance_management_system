import { useMemo, useState } from 'react'
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
import { DashboardDrilldownPanel, useDashboardDrilldown } from '@/components/dashboard/DashboardDrilldownPanel'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { UgandaDistrictMap } from '@/components/dashboard/UgandaDistrictMap'
import { DashboardErrorBoundary } from '@/components/organisms/DashboardErrorBoundary'
import { DashboardHeader } from '@/components/organisms/DashboardHeader'
import { ProgressBar } from '@/components/molecules/ProgressBar'
import { Card } from '@/components/atoms/Card'
import { QueryState } from '@/components/organisms/QueryState'
import { useAuthStore } from '@/stores/appStore'
import { buildHrManagerDrilldowns, type FacilityPerformanceRow } from '@/utils/dashboardDrilldown'
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
  const { activeId, openDrilldown, closeDrilldown, panelRef } = useDashboardDrilldown('all_facilities')
  const [mapDistrict, setMapDistrict] = useState<DistrictCoverage | null>(null)
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

  const facilities = useMemo(
    () =>
      ((data?.facility_performance as FacilityPerformanceRow[]) ??
        (data?.institution_performance as FacilityPerformanceRow[]) ??
        []) as FacilityPerformanceRow[],
    [data],
  )
  const interventions = (data?.intervention_required ?? []) as Array<Record<string, string>>

  const drilldowns = useMemo(() => {
    const base = buildHrManagerDrilldowns(facilities, districts, interventions, performance?.target ?? 95)
    if (mapDistrict) {
      base.map_district = {
        id: 'map_district',
        title: `${mapDistrict.district} — district detail`,
        description: `ISO ${mapDistrict.iso_code ?? '—'} · ${mapDistrict.region ?? '—'} region`,
        columns: ['District', 'ISO', 'Region', 'Staff', 'OOS rate', 'HRM summary', 'Combined'],
        rows: [
          {
            District: mapDistrict.district,
            ISO: mapDistrict.iso_code ?? '—',
            Region: mapDistrict.region ?? '—',
            Staff: mapDistrict.staff_count,
            'OOS rate': `${mapDistrict.oos_attendance_rate}%`,
            'HRM summary': `${mapDistrict.hrm_summary_rate}%`,
            Combined: `${mapDistrict.combined_rate}%`,
          },
        ],
      }
    }
    return base
  }, [facilities, districts, interventions, performance?.target, mapDistrict])

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
      variant="dashboard"
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
                onClick={() => openDrilldown('combined_attendance')}
                active={activeId === 'combined_attendance'}
              />
              <MetricCard
                title="OOS GPS compliance"
                value={`${performance.oos_compliance}%`}
                hint="PMS out-of-station clocks"
                icon={MapPinned}
                accent="blue"
                onClick={() => openDrilldown('oos_compliance')}
                active={activeId === 'oos_compliance'}
              />
              <MetricCard
                title="Districts on PMS"
                value={performance.districts_on_system}
                hint="Active district coverage"
                icon={Building2}
                accent="purple"
                onClick={() => openDrilldown('districts')}
                active={activeId === 'districts'}
              />
              <MetricCard
                title="Staff tracked"
                value={(performance.staff_tracked ?? 0).toLocaleString()}
                hint="Across integrated records"
                icon={Users}
                accent="green"
                onClick={() => openDrilldown('staff_tracked')}
                active={activeId === 'staff_tracked'}
              />
            </div>
          ) : null}

          <Card>
            <ProgressBar
              value={taskCompletion.percent ?? 0}
              label={taskLabel}
              sublabel={`${taskCompletion.on_track ?? 0} of ${taskCompletion.total ?? 0} facilities on track`}
              onClick={() => openDrilldown('task_completion')}
              active={activeId === 'task_completion'}
            />
          </Card>

          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              title="Facilities"
              value={summaryCards.total_facilities ?? 0}
              hint={`${summaryCards.total_staff ?? 0} staff`}
              icon={Building2}
              onClick={() => openDrilldown('all_facilities')}
              active={activeId === 'all_facilities'}
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

          {trends ? <AttendanceTrendChart trends={trends} /> : null}

          {districts.length > 0 ? (
            <DashboardErrorBoundary label="District map">
              <UgandaDistrictMap
                districts={districts}
                onDistrictClick={(district) => {
                  setMapDistrict(district)
                  openDrilldown('map_district')
                }}
              />
            </DashboardErrorBoundary>
          ) : null}

          <DashboardDrilldownPanel
            drilldowns={drilldowns}
            activeId={activeId}
            onClose={closeDrilldown}
            panelRef={panelRef}
          />

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

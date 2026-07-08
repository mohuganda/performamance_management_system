import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '@/api/services/pms'
import { DashboardDrilldownPanel, useDashboardDrilldown } from '@/components/dashboard/DashboardDrilldownPanel'
import { DashboardHeader } from '@/components/organisms/DashboardHeader'
import { ProgressBar } from '@/components/molecules/ProgressBar'
import { SummaryCard } from '@/components/molecules/SummaryCard'
import { Card } from '@/components/atoms/Card'
import { ModuleQuickLinks } from '@/components/organisms/ModuleQuickLinks'
import { QueryState } from '@/components/organisms/QueryState'
import { useAuthStore } from '@/stores/appStore'
import { buildSupervisorDrilldowns } from '@/utils/dashboardDrilldown'

export function SupervisorDashboard() {
  const { displayName, quarter } = useAuthStore()
  const { activeId, openDrilldown, closeDrilldown, panelRef } = useDashboardDrilldown('total_staff')
  const { data, isLoading, isError, error, refetch, isPending } = useQuery({
    queryKey: ['dashboard', 'supervisor', quarter],
    queryFn: () => dashboardService.supervisor('Ward A', quarter),
  })

  const summaryCards = (data?.summary_cards ?? {}) as Record<string, number>
  const teamCompletion = (data?.team_task_completion ?? {}) as {
    percent?: number
    on_track?: number
    total?: number
  }
  const pendingApprovals = (data?.pending_approvals ?? []) as Array<Record<string, string>>
  const teamMembers = (data?.team_members ?? []) as Array<Record<string, string | number>>
  const pipCandidates = (data?.pip_candidates ?? []) as Array<Record<string, string>>

  const drilldowns = useMemo(
    () => buildSupervisorDrilldowns(teamMembers, pendingApprovals, pipCandidates),
    [teamMembers, pendingApprovals, pipCandidates],
  )

  return (
    <QueryState
      isLoading={isLoading}
      isPending={isPending}
      isError={isError}
      error={error}
      label="supervisor dashboard"
      variant="dashboard"
      onRetry={() => refetch()}
    >
      {data ? (
        <div className="space-y-6 p-4 md:p-6">
          <ModuleQuickLinks />
          <DashboardHeader
            title="Performance Management System (iHRIS-PMS)"
            welcome={`Welcome, ${displayName} - Supervisor`}
            context={`Team: ${(data.team as string) ?? '—'}`}
            quarter={quarter}
          />

          <Card>
            <ProgressBar
              value={teamCompletion.percent ?? 0}
              label="Team Task Completion"
              sublabel={`${teamCompletion.on_track ?? 0} of ${teamCompletion.total ?? 0} staff on track`}
              onClick={() => openDrilldown('task_completion')}
              active={activeId === 'task_completion'}
            />
          </Card>

          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard
              title="Total Staff"
              value={summaryCards.total_staff ?? 0}
              onClick={() => openDrilldown('total_staff')}
              active={activeId === 'total_staff'}
            />
            <SummaryCard
              title="On Track"
              value={summaryCards.on_track ?? 0}
              accent="green"
              onClick={() => openDrilldown('on_track')}
              active={activeId === 'on_track'}
            />
            <SummaryCard
              title="At Risk"
              value={summaryCards.at_risk ?? 0}
              hint="<60% tasks"
              accent="amber"
              onClick={() => openDrilldown('at_risk')}
              active={activeId === 'at_risk'}
            />
            <SummaryCard
              title="Off Track"
              value={summaryCards.off_track ?? 0}
              hint=">2 missed tasks"
              accent="red"
              onClick={() => openDrilldown('off_track')}
              active={activeId === 'off_track'}
            />
          </div>

          {pendingApprovals.length > 0 ? (
            <Card className="p-4">
              <button
                type="button"
                className="text-left text-sm font-bold uppercase text-moh-green hover:underline"
                onClick={() => openDrilldown('pending_approvals')}
              >
                {pendingApprovals.length} pending approval(s) — view detail →
              </button>
            </Card>
          ) : null}

          {pipCandidates.length > 0 ? (
            <Card className="p-4">
              <button
                type="button"
                className="text-left text-sm font-bold uppercase text-moh-green hover:underline"
                onClick={() => openDrilldown('pip_candidates')}
              >
                {pipCandidates.length} PIP candidate(s) — view detail →
              </button>
            </Card>
          ) : null}

          <DashboardDrilldownPanel
            drilldowns={drilldowns}
            activeId={activeId}
            onClose={closeDrilldown}
            panelRef={panelRef}
          />
        </div>
      ) : (
        <Card className="m-4 md:m-6">
          <p className="text-sm text-gray-600">No dashboard data returned. Try refreshing the page.</p>
        </Card>
      )}
    </QueryState>
  )
}

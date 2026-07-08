import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '@/api/services/pms'
import { DashboardHeader } from '@/components/organisms/DashboardHeader'
import { DataTable } from '@/components/organisms/DataTable'
import { ProgressBar } from '@/components/molecules/ProgressBar'
import { SummaryCard } from '@/components/molecules/SummaryCard'
import { Card } from '@/components/atoms/Card'
import { ModuleQuickLinks } from '@/components/organisms/ModuleQuickLinks'
import { QueryState } from '@/components/organisms/QueryState'
import { useAuthStore } from '@/stores/appStore'

export function SupervisorDashboard() {
  const { displayName, quarter } = useAuthStore()
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

  return (
    <QueryState
      isLoading={isLoading}
      isPending={isPending}
      isError={isError}
      error={error}
      label="supervisor dashboard"
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
            />
          </Card>

          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard title="Total Staff" value={summaryCards.total_staff ?? 0} />
            <SummaryCard title="On Track" value={summaryCards.on_track ?? 0} />
            <SummaryCard title="At Risk" value={summaryCards.at_risk ?? 0} hint="<60% tasks" />
            <SummaryCard title="Off Track" value={summaryCards.off_track ?? 0} hint=">2 missed tasks" />
          </div>

          <DataTable
            title="Pending Approvals (Requires Your Action)"
            columns={['Type', 'Staff Name', 'Details', 'Date', 'Action']}
            rows={pendingApprovals.map((row) => ({
              Type: row.type,
              'Staff Name': row.staff_name,
              Details: row.details,
              Date: row.date,
              Action: row.action,
            }))}
          />

          <DataTable
            title="Team Member Task Completion (Q1)"
            columns={['Staff Name', 'Tasks Due', 'Completed', '% Complete', 'Status']}
            rows={teamMembers.map((row) => ({
              'Staff Name': row.staff_name,
              'Tasks Due': row.tasks_due,
              Completed: row.completed,
              '% Complete': `${row.percent}%`,
              Status: String(row.status).replace('_', ' '),
            }))}
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

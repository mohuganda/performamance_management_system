import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Input, Option, Select, Typography } from '@material-tailwind/react'
import { staffAdminService } from '@/api/services/mobile'
import {
  normalizeSupervision,
  normalizeSupervisorCandidates,
} from '@/utils/normalizeApi'
import { unwrapPaginated } from '@/types/pagination'
import { PageHeader } from '@/components/organisms/PageHeader'
import { ProcessGuide } from '@/components/organisms/ProcessGuide'
import { QueryState } from '@/components/organisms/QueryState'
import { ServerPaginatedTable } from '@/components/organisms/ServerPaginatedTable'
import { useAdminPageSize } from '@/hooks/useAdminPageSize'
import { mt } from '@/utils/mt'

const SUPERVISION_STEPS = [
  {
    title: 'Identify staff without supervisors',
    description:
      'Review the list below. Staff marked “No supervisor” cannot submit leave or out-of-station requests until a supervisor is assigned.',
    actor: 'HR Officer',
  },
  {
    title: 'Select a supervisor',
    description:
      'Choose a supervisor from active staff at the same or parent facility — typically the head of unit, senior officer, or line manager.',
    actor: 'HR Officer',
  },
  {
    title: 'Assign and verify',
    description:
      'Save the assignment. The employee can then submit leave/OOS applications; the assigned supervisor will see pending approvals on their Leave and Out of Station pages.',
    actor: 'HR Officer',
  },
]

export function SupervisionAdminPage() {
  const queryClient = useQueryClient()
  const pageSize = useAdminPageSize()
  const [search, setSearch] = useState('')
  const [supervisorFilter, setSupervisorFilter] = useState('')
  const [page, setPage] = useState(1)
  const [assignments, setAssignments] = useState<Record<number, string>>({})

  const listQuery = useQuery({
    queryKey: ['admin', 'supervision', search, supervisorFilter, page, pageSize],
    queryFn: async () => {
      const raw = await staffAdminService.listSupervision({
        search: search || undefined,
        has_supervisor: supervisorFilter || undefined,
        page,
        per_page: pageSize,
      })
      const paged = unwrapPaginated(raw)
      return {
        ...paged,
        data: normalizeSupervision(paged.data),
      }
    },
  })

  const candidatesQuery = useQuery({
    queryKey: ['admin', 'supervisor-candidates'],
    queryFn: async () => normalizeSupervisorCandidates(await staffAdminService.listSupervisorCandidates()),
  })

  const assignMutation = useMutation({
    mutationFn: ({ staffId, supervisorId }: { staffId: number; supervisorId: number }) =>
      staffAdminService.assignSupervisor(staffId, supervisorId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'supervision'] }),
  })

  const rows = listQuery.data?.data ?? []
  const pagination = listQuery.data ?? { total: 0, page: 1, per_page: pageSize, total_pages: 1 }
  const candidates = candidatesQuery.data ?? []
  const unassigned = rows.filter((r) => !r.has_supervisor)

  return (
    <div>
      <PageHeader
        title="Staff Supervision"
        subtitle="Assign supervisors so employees can submit leave and out-of-station requests"
      />

      <ProcessGuide title="How to assign supervisors" steps={SUPERVISION_STEPS} />

      <Card {...mt} className="mb-6 rounded-sm border border-moh-warning/30 bg-moh-warning/5 p-4">
        <Typography {...mt} className="text-sm">
          <strong>{unassigned.length}</strong> staff member{unassigned.length === 1 ? '' : 's'} without
          a supervisor
          {unassigned.length > 0
            ? '. These employees will see an error when submitting leave or travel requests.'
            : '.'}
        </Typography>
      </Card>

      <Card {...mt} className="mb-4 rounded-sm border border-ui-border p-4">
        <div className="flex flex-wrap gap-3">
          <Input
            {...mt}
            label="Search staff"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="min-w-[200px] flex-1"
          />
          <Select
            {...mt}
            label="Supervisor status"
            value={supervisorFilter}
            onChange={(v) => {
              setSupervisorFilter(v ?? '')
              setPage(1)
            }}
            className="min-w-[180px]"
          >
            <Option value="">All staff</Option>
            <Option value="false">No supervisor</Option>
            <Option value="true">Has supervisor</Option>
          </Select>
        </div>
      </Card>

      <QueryState
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        error={listQuery.error}
        label="staff supervision"
        onRetry={() => listQuery.refetch()}
      >
        <ServerPaginatedTable
          columns={[
            { key: 'employee', label: 'Employee' },
            { key: 'job', label: 'Job / Facility' },
            { key: 'supervisor', label: 'Current supervisor' },
            { key: 'assign', label: 'Assign supervisor' },
          ]}
          rows={rows}
          pagination={pagination}
          onPageChange={setPage}
          rowKey={(row) => row.staff_id}
          renderRow={(row) => (
            <>
              <td className="px-3 py-3 font-medium">{row.staff_name}</td>
              <td className="px-3 py-3 text-ui-muted">
                {row.job_title}
                <br />
                <span className="text-xs">{row.facility_name}</span>
              </td>
              <td className="px-3 py-3">
                {row.has_supervisor ? (
                  <span className="text-moh-green">{row.supervisor_name}</span>
                ) : (
                  <span className="font-semibold text-moh-warning">Not assigned</span>
                )}
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    {...mt}
                    label="Supervisor"
                    value={assignments[row.staff_id] ?? ''}
                    onChange={(v) =>
                      setAssignments((prev) => ({ ...prev, [row.staff_id]: v ?? '' }))
                    }
                    className="min-w-[200px]"
                  >
                    {candidates
                      .filter((c) => c.staff_id !== row.staff_id)
                      .map((c) => (
                        <Option key={c.staff_id} value={String(c.staff_id)}>
                          {c.name} — {c.job_title}
                        </Option>
                      ))}
                  </Select>
                  <Button
                    {...mt}
                    size="sm"
                    className="rounded-sm bg-moh-green"
                    disabled={!assignments[row.staff_id] || assignMutation.isPending}
                    onClick={() =>
                      assignMutation.mutate({
                        staffId: row.staff_id,
                        supervisorId: Number(assignments[row.staff_id]),
                      })
                    }
                  >
                    Save
                  </Button>
                </div>
              </td>
            </>
          )}
        />
      </QueryState>
    </div>
  )
}

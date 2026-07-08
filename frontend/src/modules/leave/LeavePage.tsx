import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Textarea, Typography } from '@material-tailwind/react'
import { SearchableSelect } from '@/components/molecules/SearchableSelect'
import { leaveService } from '@/api/services/mobile'
import { DatePickerField } from '@/components/molecules/DatePickerField'
import { PageHeader } from '@/components/organisms/PageHeader'
import { ProcessGuide } from '@/components/organisms/ProcessGuide'
import { QueryState } from '@/components/organisms/QueryState'
import { useAuthStore } from '@/stores/appStore'
import { normalizeLeaveTypes } from '@/utils/normalizeApi'
import { mt } from '@/utils/mt'
import { parseISO } from 'date-fns'

const LEAVE_STEPS = [
  {
    title: 'Check your balance',
    description: 'Confirm you have enough days for the leave type you need (annual, sick, etc.).',
    actor: 'Employee',
  },
  {
    title: 'Submit application',
    description:
      'Fill in leave type, dates, and reason. Submit at least 14 days before annual leave starts. Sick leave over 2 days needs a medical report.',
    actor: 'Employee',
  },
  {
    title: 'Approval chain',
    description:
      'Your request routes through the configured workflow: typically your first supervisor, then facility HR (or district/ministry approvers when defined). Senior roles may require ministry HR and Permanent Secretary approval.',
    actor: 'Approvers',
  },
  {
    title: 'HR records update',
    description: 'After all approval stages complete, HR finalises the leave on your record and updates balances.',
    actor: 'HR Officer',
  },
]

export function LeavePage() {
  const { hasPermission, staffId } = useAuthStore()
  const queryClient = useQueryClient()
  const canCreate = hasPermission('leave.requests.create')
  const canApprove = hasPermission('leave.requests.approve')

  const [form, setForm] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    submit: true,
  })
  const [approvalComment, setApprovalComment] = useState('')

  const balancesQuery = useQuery({
    queryKey: ['leave', 'balances'],
    queryFn: () => leaveService.listBalances(),
    enabled: Boolean(staffId),
  })

  const typesQuery = useQuery({
    queryKey: ['leave', 'types'],
    queryFn: () => leaveService.listTypes(),
  })

  const requestsQuery = useQuery({
    queryKey: ['leave', 'requests'],
    queryFn: () => leaveService.listRequests(),
    enabled: Boolean(staffId),
  })

  const pendingQuery = useQuery({
    queryKey: ['leave', 'pending-approvals'],
    queryFn: () => leaveService.listPendingApprovals(),
    enabled: Boolean(staffId) && canApprove,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      leaveService.createRequest({
        leave_type_id: Number(form.leave_type_id),
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason,
        submit: form.submit,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave'] })
      setForm({ leave_type_id: '', start_date: '', end_date: '', reason: '', submit: true })
    },
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, approve }: { id: number; approve: boolean }) =>
      leaveService.approve(id, { approve, comments: approvalComment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave'] })
      setApprovalComment('')
    },
  })

  const staffLinked = Boolean(staffId)
  const leaveTypes = normalizeLeaveTypes(typesQuery.data)
  const typeById = new Map(leaveTypes.map((t) => [t.id, t.name]))
  const startDateValue = form.start_date ? parseISO(form.start_date) : undefined

  return (
    <div>
      <PageHeader
        title="Leave Management"
        subtitle="Apply for leave and track approvals through your configured workflow"
      />

      <ProcessGuide title="How leave application works" steps={LEAVE_STEPS} />

      {!staffLinked ? (
        <Card {...mt} className="rounded-sm border border-moh-warning/40 p-4">
          <Typography {...mt} className="text-sm text-moh-warning">
            Your account is not linked to a staff record. Contact HR to link your iHRIS profile
            before applying for leave.
          </Typography>
        </Card>
      ) : null}

      {canApprove && staffLinked ? (
        <QueryState
          isLoading={pendingQuery.isLoading}
          isError={pendingQuery.isError}
          error={pendingQuery.error}
          label="pending leave approvals"
          variant="cards"
          onRetry={() => pendingQuery.refetch()}
        >
          <Card {...mt} className="mb-6 rounded-sm border border-uganda-yellow/50 bg-uganda-yellow/5 p-4">
            <Typography {...mt} className="mb-3 text-sm font-bold uppercase text-ui-text">
              Pending approvals — action required
            </Typography>
            {Array.isArray(pendingQuery.data) && pendingQuery.data.length > 0 ? (
              <div className="space-y-4">
                {pendingQuery.data.map(
                  (row: {
                    approval_id: number
                    staff_name: string
                    leave_type_name: string
                    start_date: string
                    end_date: string
                    days_requested: number
                    reason: string
                    stage_name?: string
                    stage_code?: string
                  }) => (
                    <div
                      key={row.approval_id}
                      className="rounded-sm border border-ui-border bg-white p-3"
                    >
                      <p className="font-semibold">{row.staff_name}</p>
                      {row.stage_name ? (
                        <p className="text-xs font-medium uppercase tracking-wide text-moh-green">
                          Your step: {row.stage_name}
                        </p>
                      ) : null}
                      <p className="text-sm text-ui-muted">
                        {row.leave_type_name} · {row.start_date} – {row.end_date} ({row.days_requested}{' '}
                        days)
                      </p>
                      {row.reason ? (
                        <p className="mt-1 text-sm text-ui-text">Reason: {row.reason}</p>
                      ) : null}
                      <Textarea
                        {...mt}
                        label="Comment (optional)"
                        value={approvalComment}
                        onChange={(e) => setApprovalComment(e.target.value)}
                        className="mt-2"
                      />
                      <div className="mt-2 flex gap-2">
                        <Button
                          {...mt}
                          size="sm"
                          className="rounded-sm bg-moh-green"
                          disabled={approveMutation.isPending}
                          onClick={() =>
                            approveMutation.mutate({ id: row.approval_id, approve: true })
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          {...mt}
                          size="sm"
                          variant="outlined"
                          className="rounded-sm"
                          disabled={approveMutation.isPending}
                          onClick={() =>
                            approveMutation.mutate({ id: row.approval_id, approve: false })
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <Typography {...mt} className="text-sm text-ui-muted">
                No leave requests waiting for your approval.
              </Typography>
            )}
          </Card>
        </QueryState>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <QueryState
          isLoading={balancesQuery.isLoading}
          isError={balancesQuery.isError}
          error={balancesQuery.error}
          label="leave balances"
          variant="cards"
          onRetry={() => balancesQuery.refetch()}
        >
          <Card {...mt} className="rounded-sm border border-moh-green/15 p-4 lg:col-span-1">
            <Typography {...mt} className="mb-3 text-sm font-bold uppercase text-moh-green">
              Leave Balances
            </Typography>
            {Array.isArray(balancesQuery.data) && balancesQuery.data.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {balancesQuery.data.map((row: Record<string, unknown>) => {
                  const typeId = row.leave_type_id as number
                  const typeName = typeById.get(typeId) ?? 'Leave'
                  const remaining =
                    Number(row.entitled_days ?? 0) +
                    Number(row.carried_over_days ?? 0) -
                    Number(row.used_days ?? 0)
                  return (
                    <li
                      key={String(row.id ?? typeId)}
                      className="flex justify-between border-b border-gray-100 py-2"
                    >
                      <span>{typeName}</span>
                      <span className="font-semibold text-moh-green">{remaining} days</span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Typography {...mt} className="text-sm text-gray-500">
                No balance records for this year.
              </Typography>
            )}
          </Card>
        </QueryState>

        {canCreate && staffLinked ? (
          <Card {...mt} className="rounded-sm border border-moh-green/15 p-4 lg:col-span-2">
            <Typography {...mt} className="mb-4 text-sm font-bold uppercase text-moh-green">
              Step 2 — New Leave Application
            </Typography>
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                createMutation.mutate()
              }}
            >
              <SearchableSelect
                label="Leave type"
                value={form.leave_type_id}
                placeholder="Search leave type…"
                emptyLabel="Select leave type"
                allowClear={false}
                options={leaveTypes.map((t) => ({
                  value: String(t.id),
                  label: t.name,
                  description: t.code,
                }))}
                onChange={(v) => setForm((f) => ({ ...f, leave_type_id: v }))}
              />
              <DatePickerField
                label="Start date"
                value={form.start_date}
                onChange={(start_date) => setForm((f) => ({ ...f, start_date }))}
                className="rounded-sm"
              />
              <DatePickerField
                label="End date"
                value={form.end_date}
                onChange={(end_date) => setForm((f) => ({ ...f, end_date }))}
                minDate={startDateValue}
                className="rounded-sm"
              />
              <div className="md:col-span-2">
                <Textarea
                  {...mt}
                  label="Reason"
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
              {createMutation.isError ? (
                <Typography {...mt} className="text-sm text-moh-error md:col-span-2">
                  {(createMutation.error as Error).message}
                  {(createMutation.error as Error).message?.includes('supervisor') ? (
                    <span>
                      {' '}
                      Ask HR to assign a supervisor under Admin → Staff Management.
                    </span>
                  ) : null}
                </Typography>
              ) : null}
              <Button
                {...mt}
                type="submit"
                className="rounded-sm bg-moh-green md:col-span-2"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Submitting...' : 'Submit for supervisor approval'}
              </Button>
            </form>
          </Card>
        ) : null}
      </div>

      <QueryState
        isLoading={requestsQuery.isLoading}
        isError={requestsQuery.isError}
        error={requestsQuery.error}
        label="leave requests"
        variant="table"
        onRetry={() => requestsQuery.refetch()}
      >
        <Card {...mt} className="mt-6 rounded-sm border border-moh-green/15 p-4">
          <Typography {...mt} className="mb-3 text-sm font-bold uppercase text-moh-green">
            {canApprove ? 'All leave requests (team + mine)' : 'My leave requests'}
          </Typography>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Period</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Days</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(requestsQuery.data) ? requestsQuery.data : []).map(
                  (row: Record<string, unknown>) => (
                    <tr key={String(row.id)} className="border-b border-gray-100">
                      <td className="py-2 pr-4">
                        {typeById.get(row.leave_type_id as number) ?? '—'}
                      </td>
                      <td className="py-2 pr-4">
                        {String(row.start_date).slice(0, 10)} – {String(row.end_date).slice(0, 10)}
                      </td>
                      <td className="py-2 pr-4 font-medium capitalize text-moh-green">
                        {String(row.status ?? 'pending')}
                      </td>
                      <td className="py-2">{String(row.days_requested ?? '—')}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </QueryState>
    </div>
  )
}

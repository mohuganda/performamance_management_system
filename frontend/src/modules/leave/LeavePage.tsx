import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Textarea, Typography } from '@material-tailwind/react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { getApiErrorMessage } from '@/api/client'
import { FileAttachmentField } from '@/components/molecules/FileAttachmentField'
import { SearchableSelect } from '@/components/molecules/SearchableSelect'
import { leaveService } from '@/api/services/mobile'
import { DatePickerField } from '@/components/molecules/DatePickerField'
import { FormStatusAlert, type FormStatusType } from '@/components/molecules/FormStatusAlert'
import { PageHeader } from '@/components/organisms/PageHeader'
import { ProcessGuide } from '@/components/organisms/ProcessGuide'
import { QueryState } from '@/components/organisms/QueryState'
import { notifyApiError, toast } from '@/features/toast'
import { useAuthStore } from '@/stores/appStore'
import { serializeAttachments, type AttachmentMeta } from '@/utils/attachments'
import { normalizeLeaveTypes } from '@/utils/normalizeApi'
import { mt } from '@/utils/mt'
import { minLeaveStartDate, validateLeaveDates, type LeavePolicyConfig } from '@/utils/leavePolicy'

type FormAlert = { type: FormStatusType; message: string; title?: string }

function validateLeaveForm(
  form: {
    leave_type_id: string
    start_date: string
    end_date: string
    reason: string
  },
  policy: LeavePolicyConfig | undefined,
  leaveType: { code?: string; advance_notice_days?: number | null } | undefined,
): string | null {
  if (!form.leave_type_id) return 'Select a leave type before continuing.'
  if (!form.start_date) return 'Enter a start date.'
  if (!form.end_date) return 'Enter an end date.'
  const dateError = validateLeaveDates(form, policy, leaveType)
  if (dateError) return dateError
  if (!form.reason.trim()) return 'Provide a reason for your leave request.'
  return null
}

const LEAVE_STEPS = [
  {
    title: 'Check your balance',
    description: 'Confirm you have enough days for the leave type you need (annual, sick, etc.).',
    actor: 'Employee',
  },
  {
    title: 'Submit application',
    description:
      'Fill in leave type, dates, and reason. Most leave types require advance notice (configurable by HR). Sick leave may be exempt. Past dates are not allowed.',
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
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([])
  const [formAlert, setFormAlert] = useState<FormAlert | null>(null)
  const [approvalAlert, setApprovalAlert] = useState<FormAlert | null>(null)

  const balancesQuery = useQuery({
    queryKey: ['leave', 'balances'],
    queryFn: () => leaveService.listBalances(),
    enabled: Boolean(staffId),
  })

  const typesQuery = useQuery({
    queryKey: ['leave', 'types'],
    queryFn: () => leaveService.listTypes(),
  })

  const configQuery = useQuery({
    queryKey: ['leave', 'config'],
    queryFn: () => leaveService.getConfig(),
    staleTime: 60_000,
  })

  const leavePolicy = (configQuery.data as { settings?: LeavePolicyConfig } | undefined)?.settings

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
    mutationFn: (submit: boolean) =>
      leaveService.createRequest({
        leave_type_id: Number(form.leave_type_id),
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason,
        medical_report_url: serializeAttachments(attachments),
        submit,
      }),
    onSuccess: (_data, submit) => {
      queryClient.invalidateQueries({ queryKey: ['leave'] })
      setForm({ leave_type_id: '', start_date: '', end_date: '', reason: '', submit: true })
      setAttachments([])
      const message = submit
        ? 'Your leave request has been submitted for supervisor approval.'
        : 'Your leave request has been saved as a draft. You can submit it when ready.'
      setFormAlert({
        type: 'success',
        title: submit ? 'Submitted' : 'Draft saved',
        message,
      })
      toast.success(message, submit ? 'Leave submitted' : 'Draft saved')
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error, 'Could not save leave request')
      setFormAlert({ type: 'error', title: 'Could not save', message })
      notifyApiError(error, 'Could not save leave request')
    },
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, approve }: { id: number; approve: boolean }) =>
      leaveService.approve(id, { approve, comments: approvalComment }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leave'] })
      setApprovalComment('')
      const message = variables.approve
        ? 'Leave request approved and moved to the next stage.'
        : 'Leave request returned to the employee.'
      setApprovalAlert({
        type: 'success',
        title: variables.approve ? 'Approved' : 'Returned',
        message,
      })
      toast.success(message, variables.approve ? 'Leave approved' : 'Leave returned')
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error, 'Could not process leave approval')
      setApprovalAlert({ type: 'error', title: 'Action failed', message })
      notifyApiError(error, 'Could not process leave approval')
    },
  })

  const handleCreate = (submit: boolean) => {
    const validationError = validateLeaveForm(form, leavePolicy, selectedLeaveType)
    if (validationError) {
      setFormAlert({ type: 'warning', title: 'Check the form', message: validationError })
      toast.warning(validationError, 'Leave form')
      return
    }
    if (needsMedicalReport && attachments.length === 0) {
      const message = `A medical report is required for ${selectedLeaveType?.name ?? 'this leave type'} longer than ${selectedLeaveType?.medical_report_after_days} days.`
      setFormAlert({ type: 'warning', title: 'Medical report required', message })
      toast.warning(message, 'Leave form')
      return
    }
    setFormAlert(null)
    createMutation.mutate(submit)
  }

  const staffLinked = Boolean(staffId)
  const leaveTypes = normalizeLeaveTypes(typesQuery.data)
  const typeById = new Map(leaveTypes.map((t) => [t.id, t.name]))
  const selectedLeaveType = leaveTypes.find((t) => String(t.id) === form.leave_type_id)
  const leaveDays =
    form.start_date && form.end_date
      ? differenceInCalendarDays(parseISO(form.end_date), parseISO(form.start_date)) + 1
      : 0
  const needsMedicalReport =
    selectedLeaveType?.medical_report_after_days != null &&
    leaveDays > selectedLeaveType.medical_report_after_days
  const startDateValue = form.start_date ? parseISO(form.start_date) : undefined
  const minLeaveDate = minLeaveStartDate(leavePolicy, selectedLeaveType)
  const advanceNoticeDays =
    selectedLeaveType?.advance_notice_days ?? leavePolicy?.advance_notice_days ?? 14
  const sickExempt =
    leavePolicy?.exempt_sick_leave_advance_notice !== false && selectedLeaveType?.code === 'sick'
  const showAdvanceNotice =
    leavePolicy?.enforce_advance_notice !== false && !sickExempt && advanceNoticeDays > 0

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
            {approvalAlert ? (
              <FormStatusAlert
                type={approvalAlert.type}
                title={approvalAlert.title}
                message={approvalAlert.message}
                onDismiss={() => setApprovalAlert(null)}
                className="mb-4"
              />
            ) : null}
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
                      className="rounded-sm border border-ui-border bg-ui-surface p-3"
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
            {formAlert ? (
              <FormStatusAlert
                type={formAlert.type}
                title={formAlert.title}
                message={formAlert.message}
                onDismiss={() => setFormAlert(null)}
                className="mb-4"
              />
            ) : null}
            {showAdvanceNotice ? (
              <p className="mb-4 rounded-sm border border-ui-border bg-ui-subtle/40 px-3 py-2 text-sm text-ui-muted">
                Apply at least <strong>{advanceNoticeDays} days</strong> before your leave starts.
                Earliest start date: <strong>{format(minLeaveDate, 'dd MMM yyyy')}</strong>.
              </p>
            ) : leavePolicy?.block_past_dates !== false ? (
              <p className="mb-4 rounded-sm border border-ui-border bg-ui-subtle/40 px-3 py-2 text-sm text-ui-muted">
                Past dates cannot be selected for leave applications.
              </p>
            ) : null}
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                handleCreate(true)
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
                minDate={minLeaveDate}
                className="rounded-sm"
              />
              <DatePickerField
                label="End date"
                value={form.end_date}
                onChange={(end_date) => setForm((f) => ({ ...f, end_date }))}
                minDate={startDateValue && startDateValue > minLeaveDate ? startDateValue : minLeaveDate}
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
              <div className="md:col-span-2">
                <FileAttachmentField
                  label={needsMedicalReport ? 'Medical report / supporting documents' : 'Supporting documents'}
                  hint={
                    needsMedicalReport
                      ? `Required for absences longer than ${selectedLeaveType?.medical_report_after_days} days. Upload images or PDF files.`
                      : 'Optional supporting documents (images or PDF, up to 5 files).'
                  }
                  value={attachments}
                  onChange={setAttachments}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
                <Button
                  {...mt}
                  type="button"
                  variant="outlined"
                  className="rounded-sm flex-1"
                  disabled={createMutation.isPending}
                  onClick={() => handleCreate(false)}
                >
                  {createMutation.isPending ? 'Saving...' : 'Save as draft'}
                </Button>
                <Button
                  {...mt}
                  type="submit"
                  className="rounded-sm bg-moh-green flex-1"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'Submitting...' : 'Submit for supervisor approval'}
                </Button>
              </div>
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

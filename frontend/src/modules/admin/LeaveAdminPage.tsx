import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Chip,
  Input,
  Switch,
  Tab,
  Tabs,
  TabsHeader,
  Typography,
} from '@material-tailwind/react'
import { Select, Option } from '@/components/molecules/MtSelect'
import {
  AlertCircle,
  CalendarDays,
  ClipboardList,
  Clock,
  FileText,
  Filter,
  RefreshCw,
  Search,
  Settings,
  Users,
  X,
} from 'lucide-react'
import {
  leaveAdminService,
  type LeavePolicySettings,
  type LeaveStatement,
  type StaffLeaveSummary,
} from '@/api/services/leaveAdmin'
import { PageHeader } from '@/components/organisms/PageHeader'
import { ProcessGuide } from '@/components/organisms/ProcessGuide'
import { LeaveWorkflowPanel } from '@/modules/admin/LeaveWorkflowPanel'
import { QueryState } from '@/components/organisms/QueryState'
import { ServerPaginatedTable } from '@/components/organisms/ServerPaginatedTable'
import { useAdminPageSize } from '@/hooks/useAdminPageSize'
import { useAuthStore } from '@/stores/appStore'
import { mt } from '@/utils/mt'

const LEAVE_STEPS = [
  {
    title: 'Employee submits request',
    description: 'At least 14 days advance notice (configurable). Medical report required for sick leave over 2 days.',
    actor: 'Employee',
  },
  {
    title: 'Configured approval chain',
    description: 'Routes through Supervisor 1, then facility/district/ministry job holders (e.g. HR Manager) as defined in the workflow profile.',
    actor: 'Approvers',
  },
  {
    title: 'HR records leave',
    description: 'Finalize approved requests to update balances, maintain roster compliance, and enforce carry-over rules.',
    actor: 'HR Officer',
  },
]

const currentYear = new Date().getFullYear()

function statusChipColor(status: string) {
  if (status === 'approved' || status === 'completed') return 'green'
  if (status === 'pending') return 'amber'
  if (status === 'rejected') return 'red'
  return 'gray'
}

function apiErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
  ) {
    return (error as { response: { data: { message: string } } }).response.data.message
  }
  return fallback
}

export function LeaveAdminPage() {
  const queryClient = useQueryClient()
  const pageSize = useAdminPageSize()
  const canManageWorkflow = useAuthStore((s) => s.hasPermission('leave.workflow.manage'))
  const [tab, setTab] = useState('overview')
  const [year, setYear] = useState(currentYear)
  const [balanceSearch, setBalanceSearch] = useState('')
  const [balanceDept, setBalanceDept] = useState('')
  const [balancePage, setBalancePage] = useState(1)
  const [requestSearch, setRequestSearch] = useState('')
  const [requestStatus, setRequestStatus] = useState('')
  const [requestAwaitingHr, setRequestAwaitingHr] = useState('')
  const [requestPage, setRequestPage] = useState(1)
  const [statementStaffId, setStatementStaffId] = useState<number | null>(null)
  const [statementSearch, setStatementSearch] = useState('')
  const [settingsForm, setSettingsForm] = useState<LeavePolicySettings | null>(null)
  const [settingsError, setSettingsError] = useState('')

  const overviewQuery = useQuery({
    queryKey: ['admin', 'leave', 'overview', year],
    queryFn: () => leaveAdminService.overview(year),
  })

  const departmentsQuery = useQuery({
    queryKey: ['admin', 'leave', 'departments'],
    queryFn: () => leaveAdminService.listDepartments(),
  })

  const balancesQuery = useQuery({
    queryKey: ['admin', 'leave', 'balances', year, balanceSearch, balanceDept, balancePage, pageSize],
    queryFn: () =>
      leaveAdminService.listBalances({
        year,
        search: balanceSearch || undefined,
        department_id: balanceDept ? Number(balanceDept) : undefined,
        page: balancePage,
        per_page: pageSize,
      }),
    enabled: tab === 'balances' || tab === 'statements',
  })

  const requestsQuery = useQuery({
    queryKey: ['admin', 'leave', 'requests', year, requestSearch, requestStatus, requestAwaitingHr, requestPage, pageSize],
    queryFn: () =>
      leaveAdminService.listRequests({
        search: requestSearch || undefined,
        status: requestStatus || undefined,
        awaiting_hr: requestAwaitingHr || undefined,
        page: requestPage,
        per_page: pageSize,
      }),
    enabled: tab === 'requests' || tab === 'overview',
  })

  const statementQuery = useQuery({
    queryKey: ['admin', 'leave', 'statement', statementStaffId, year],
    queryFn: () => leaveAdminService.staffStatement(statementStaffId!, year),
    enabled: !!statementStaffId,
  })

  const settingsQuery = useQuery({
    queryKey: ['admin', 'leave', 'settings'],
    queryFn: () => leaveAdminService.getSettings(),
    enabled: tab === 'configuration',
  })

  const typesQuery = useQuery({
    queryKey: ['admin', 'leave', 'types'],
    queryFn: () => leaveAdminService.listTypes(),
    enabled: tab === 'configuration' || tab === 'requests',
  })

  const entitlementsQuery = useQuery({
    queryKey: ['admin', 'leave', 'entitlements'],
    queryFn: () => leaveAdminService.listEntitlements(),
    enabled: tab === 'configuration',
  })

  const workflowProfilesQuery = useQuery({
    queryKey: ['admin', 'leave', 'workflow-profiles'],
    queryFn: () => leaveAdminService.listWorkflowProfiles(),
    enabled: tab === 'configuration',
  })

  const invalidateAll = () => queryClient.invalidateQueries({ queryKey: ['admin', 'leave'] })

  const initYearMutation = useMutation({
    mutationFn: () => leaveAdminService.initializeYear(year),
    onSuccess: invalidateAll,
  })

  const finalizeMutation = useMutation({
    mutationFn: (id: number) => leaveAdminService.finalizeRequest(id),
    onSuccess: invalidateAll,
  })

  const saveSettingsMutation = useMutation({
    mutationFn: () => leaveAdminService.updateSettings(settingsForm!),
    onSuccess: (data) => {
      setSettingsForm(data)
      setSettingsError('')
      invalidateAll()
    },
    onError: (error: unknown) => setSettingsError(apiErrorMessage(error, 'Could not save settings')),
  })

  const updateTypeWorkflowMutation = useMutation({
    mutationFn: ({ id, workflow_profile_code }: { id: number; workflow_profile_code: string }) =>
      leaveAdminService.updateType(id, { workflow_profile_code }),
    onSuccess: invalidateAll,
  })

  const departments = departmentsQuery.data ?? []
  const overview = overviewQuery.data
  const balances = balancesQuery.data?.data ?? []
  const balancePagination = balancesQuery.data ?? { total: 0, page: 1, per_page: pageSize, total_pages: 1 }
  const requests = requestsQuery.data?.data ?? []
  const requestPagination = requestsQuery.data ?? { total: 0, page: 1, per_page: pageSize, total_pages: 1 }
  const types = typesQuery.data ?? []
  const entitlements = entitlementsQuery.data ?? []
  const workflowProfiles = workflowProfilesQuery.data ?? []

  const statementMatches = useMemo(() => {
    const needle = statementSearch.trim().toLowerCase()
    if (!needle) return balances.slice(0, 8)
    return balances.filter((row) =>
      `${row.staff_name} ${row.email} ${row.department_name}`.toLowerCase().includes(needle),
    )
  }, [balances, statementSearch])

  const openStatement = (row: StaffLeaveSummary) => {
    setStatementStaffId(row.staff_id)
    setTab('statements')
  }

  useEffect(() => {
    if (tab === 'configuration' && settingsQuery.isSuccess && settingsQuery.data && !settingsForm) {
      setSettingsForm(settingsQuery.data)
    }
  }, [tab, settingsQuery.isSuccess, settingsQuery.data, settingsForm])

  return (
    <div className="pb-8">
      <PageHeader
        title="Leave Management"
        subtitle="Org-wide balances, requests, statements, and MoH leave policy configuration"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              {...mt}
              label="Year"
              value={String(year)}
              onChange={(v) => setYear(Number(v ?? currentYear))}
              className="min-w-[100px]"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <Option key={y} value={String(y)}>
                  {y}
                </Option>
              ))}
            </Select>
            <Button
              {...mt}
              size="sm"
              variant="outlined"
              className="flex items-center gap-2"
              loading={initYearMutation.isPending}
              onClick={() => initYearMutation.mutate()}
            >
              <RefreshCw className="h-4 w-4" />
              Initialize {year} balances
            </Button>
          </div>
        }
      />

      <ProcessGuide title="MoH leave workflow" steps={LEAVE_STEPS} />

      <Tabs value={tab} className="mb-4">
        <TabsHeader {...mt} className="rounded-sm bg-moh-background">
          {[
            { id: 'overview', label: 'Overview', icon: ClipboardList },
            { id: 'balances', label: 'Balances', icon: Users },
            { id: 'requests', label: 'Requests', icon: FileText },
            { id: 'statements', label: 'Statements', icon: CalendarDays },
            { id: 'configuration', label: 'Configuration', icon: Settings },
          ].map(({ id, label, icon: Icon }) => (
            <Tab key={id} {...mt} value={id} onClick={() => setTab(id)}>
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {label}
              </span>
            </Tab>
          ))}
        </TabsHeader>
      </Tabs>

      {tab === 'overview' ? (
        <QueryState
          isLoading={overviewQuery.isLoading}
          isError={overviewQuery.isError}
          error={overviewQuery.error}
          label="leave overview"
          variant="dashboard"
          onRetry={() => overviewQuery.refetch()}
        >
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Active staff', value: overview?.active_staff ?? 0, icon: Users, accent: 'text-moh-green' },
              { label: 'With balances', value: overview?.staff_with_balances ?? 0, icon: CalendarDays, accent: 'text-blue-700' },
              { label: 'Pending supervisor', value: overview?.pending_supervisor ?? 0, icon: Clock, accent: 'text-amber-700' },
              { label: 'Awaiting HR', value: overview?.awaiting_hr_finalization ?? 0, icon: AlertCircle, accent: 'text-red-600' },
            ].map((card) => (
              <Card key={card.label} {...mt} className="rounded-sm border border-moh-green/15 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">{card.label}</p>
                    <p className="mt-2 text-3xl font-bold text-ui-text">{card.value}</p>
                  </div>
                  <card.icon className={`h-8 w-8 ${card.accent} opacity-80`} />
                </div>
              </Card>
            ))}
          </div>

          <Card {...mt} className="mb-6 rounded-sm border border-moh-warning/30 bg-moh-warning/5 p-4">
            <Typography {...mt} className="text-sm">
              <strong>Policy reminders ({year}):</strong> Advance notice {overview?.advance_notice_days ?? 14} days ·
              Carry-over deadline {overview?.carry_over_deadline ?? '12-15'} ·
              Carry-over {overview?.allow_carry_over ? 'permitted with approval' : 'not permitted'}.
              Annual leave vests 1 January and should be taken within the calendar year per MoH regulations.
            </Typography>
          </Card>

          {(overview?.awaiting_hr_finalization ?? 0) > 0 ? (
            <Card {...mt} className="rounded-sm border border-ui-border p-4">
              <Typography {...mt} className="mb-3 text-sm font-bold uppercase text-moh-green">
                Awaiting HR finalization
              </Typography>
              <div className="space-y-2">
                {requests
                  .filter((r) => r.awaiting_hr)
                  .slice(0, 5)
                  .map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-medium">{r.staff_name}</span> — {r.leave_type_name} ({r.days_requested}d)
                        <span className="ml-2 text-xs text-gray-500">
                          {r.start_date} → {r.end_date}
                        </span>
                      </div>
                      <Button
                        {...mt}
                        size="sm"
                        className="rounded-sm bg-moh-green"
                        loading={finalizeMutation.isPending}
                        onClick={() => finalizeMutation.mutate(r.id)}
                      >
                        Record leave
                      </Button>
                    </div>
                  ))}
              </div>
            </Card>
          ) : null}
        </QueryState>
      ) : null}

      {tab === 'balances' ? (
        <>
          <Card {...mt} className="mb-4 rounded-sm border border-ui-border p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Filter className="h-4 w-4 text-moh-green" />
              Filter staff balances
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Input
                {...mt}
                label="Search staff"
                value={balanceSearch}
                onChange={(e) => {
                  setBalanceSearch(e.target.value)
                  setBalancePage(1)
                }}
                className="min-w-[200px] flex-1"
                icon={<Search className="h-4 w-4" />}
              />
              <Select
                {...mt}
                label="Department"
                value={balanceDept}
                onChange={(v) => {
                  setBalanceDept(v ?? '')
                  setBalancePage(1)
                }}
                className="min-w-[180px]"
              >
                <Option value="">All departments</Option>
                {departments.map((d) => (
                  <Option key={d.id} value={String(d.id)}>
                    {d.name}
                  </Option>
                ))}
              </Select>
            </div>
          </Card>

          <QueryState
            isLoading={balancesQuery.isLoading}
            isError={balancesQuery.isError}
            error={balancesQuery.error}
            label="leave balances"
            variant="table"
            onRetry={() => balancesQuery.refetch()}
          >
            <ServerPaginatedTable
              title={`Staff leave balances — ${year}`}
              description="Annual leave summary; open statement for full breakdown by leave type"
              columns={[
                { key: 'staff', label: 'Employee' },
                { key: 'dept', label: 'Department' },
                { key: 'grade', label: 'Grade' },
                { key: 'entitled', label: 'Entitled' },
                { key: 'used', label: 'Used' },
                { key: 'carried', label: 'Carried' },
                { key: 'remaining', label: 'Remaining' },
                { key: 'actions', label: '' },
              ]}
              rows={balances}
              pagination={balancePagination}
              onPageChange={setBalancePage}
              rowKey={(row) => row.staff_id}
              renderRow={(row) => (
                <>
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.staff_name}</div>
                    <div className="text-xs text-gray-500">{row.job_title}</div>
                  </td>
                  <td className="px-3 py-2">{row.department_name || '—'}</td>
                  <td className="px-3 py-2">{row.salary_grade || '—'}</td>
                  <td className="px-3 py-2">{row.annual_entitled}</td>
                  <td className="px-3 py-2">{row.annual_used}</td>
                  <td className="px-3 py-2">{row.annual_carried}</td>
                  <td className="px-3 py-2">
                    <span className={row.annual_remaining <= 5 ? 'font-semibold text-amber-700' : 'font-medium text-moh-green'}>
                      {row.annual_remaining}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Button {...mt} size="sm" variant="text" onClick={() => openStatement(row)}>
                      Statement
                    </Button>
                  </td>
                </>
              )}
            />
          </QueryState>
        </>
      ) : null}

      {tab === 'requests' ? (
        <>
          <Card {...mt} className="mb-4 rounded-sm border border-ui-border p-4">
            <div className="flex flex-wrap items-end gap-3">
              <Input
                {...mt}
                label="Search requests"
                value={requestSearch}
                onChange={(e) => {
                  setRequestSearch(e.target.value)
                  setRequestPage(1)
                }}
                className="min-w-[200px] flex-1"
                icon={<Search className="h-4 w-4" />}
              />
              <Select
                {...mt}
                label="Status"
                value={requestStatus}
                onChange={(v) => {
                  setRequestStatus(v ?? '')
                  setRequestPage(1)
                }}
                className="min-w-[140px]"
              >
                <Option value="">All</Option>
                <Option value="pending">Pending</Option>
                <Option value="approved">Approved</Option>
                <Option value="rejected">Rejected</Option>
                <Option value="draft">Draft</Option>
              </Select>
              <Select
                {...mt}
                label="HR queue"
                value={requestAwaitingHr}
                onChange={(v) => {
                  setRequestAwaitingHr(v ?? '')
                  setRequestPage(1)
                }}
                className="min-w-[160px]"
              >
                <Option value="">All requests</Option>
                <Option value="true">Awaiting HR only</Option>
              </Select>
            </div>
          </Card>

          <QueryState
            isLoading={requestsQuery.isLoading}
            isError={requestsQuery.isError}
            error={requestsQuery.error}
            label="leave requests"
            variant="table"
            onRetry={() => requestsQuery.refetch()}
          >
            <ServerPaginatedTable
              title="Organisation leave requests"
              description="Supervisor-approved requests need HR finalization to update balances"
              columns={[
                { key: 'employee', label: 'Employee' },
                { key: 'type', label: 'Leave type' },
                { key: 'dates', label: 'Dates' },
                { key: 'days', label: 'Days' },
                { key: 'status', label: 'Status' },
                { key: 'stage', label: 'Stage' },
                { key: 'actions', label: '' },
              ]}
              rows={requests}
              pagination={requestPagination}
              onPageChange={setRequestPage}
              rowKey={(row) => row.id}
              renderRow={(row) => (
                <>
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.staff_name}</div>
                    <div className="text-xs text-gray-500">{row.department_name || row.facility_name}</div>
                  </td>
                  <td className="px-3 py-2">{row.leave_type_name}</td>
                  <td className="px-3 py-2 text-sm">
                    {row.start_date}
                    <br />
                    <span className="text-gray-500">to {row.end_date}</span>
                  </td>
                  <td className="px-3 py-2">{row.days_requested}</td>
                  <td className="px-3 py-2">
                    <Chip
                      {...mt}
                      size="sm"
                      value={row.status}
                      className="rounded-sm capitalize"
                      color={statusChipColor(row.status)}
                    />
                  </td>
                  <td className="px-3 py-2 capitalize">{row.approval_stage.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-2">
                    {row.awaiting_hr ? (
                      <Button
                        {...mt}
                        size="sm"
                        className="rounded-sm bg-moh-green"
                        loading={finalizeMutation.isPending}
                        onClick={() => finalizeMutation.mutate(row.id)}
                      >
                        Record
                      </Button>
                    ) : (
                      <Button {...mt} size="sm" variant="text" onClick={() => setStatementStaffId(row.staff_id)}>
                        Statement
                      </Button>
                    )}
                  </td>
                </>
              )}
            />
          </QueryState>
        </>
      ) : null}

      {tab === 'statements' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card {...mt} className="rounded-sm border border-ui-border p-4 lg:col-span-1">
            <Typography {...mt} className="mb-3 text-sm font-bold uppercase text-moh-green">
              Find employee
            </Typography>
            <Input
              {...mt}
              label="Search staff"
              value={statementSearch}
              onChange={(e) => setStatementSearch(e.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
            <div className="mt-4 max-h-[420px] space-y-1 overflow-y-auto">
              {statementMatches.map((row) => (
                <button
                  key={row.staff_id}
                  type="button"
                  className={`w-full rounded-sm border px-3 py-2 text-left text-sm transition ${
                    statementStaffId === row.staff_id
                      ? 'border-moh-green bg-moh-green/10'
                      : 'border-gray-100 hover:bg-gray-50'
                  }`}
                  onClick={() => setStatementStaffId(row.staff_id)}
                >
                  <div className="font-medium">{row.staff_name}</div>
                  <div className="text-xs text-gray-500">
                    Annual remaining: {row.annual_remaining} days
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <div className="lg:col-span-2">
            {statementStaffId ? (
              <StatementPanel
                statement={statementQuery.data}
                isLoading={statementQuery.isLoading}
                isError={statementQuery.isError}
                error={statementQuery.error}
                onRetry={() => statementQuery.refetch()}
                year={year}
              />
            ) : (
              <Card {...mt} className="rounded-sm border border-dashed border-gray-200 p-8 text-center">
                <CalendarDays className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <Typography {...mt} className="text-sm text-gray-500">
                  Select an employee to view their {year} leave statement — balances, usage, and request history.
                </Typography>
              </Card>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'configuration' ? (
        <QueryState
          isLoading={settingsQuery.isLoading || typesQuery.isLoading}
          isError={settingsQuery.isError || typesQuery.isError}
          error={settingsQuery.error ?? typesQuery.error}
          label="leave configuration"
          variant="form"
          onRetry={() => {
            settingsQuery.refetch()
            typesQuery.refetch()
          }}
        >
          {settingsForm ? (
            <div className="space-y-6">
              <Card {...mt} className="rounded-sm border border-moh-green/15 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-moh-green" />
                  <Typography {...mt} className="text-sm font-bold uppercase text-moh-green">
                    Global policy settings
                  </Typography>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <Input
                    {...mt}
                    type="number"
                    label="Advance notice (days)"
                    value={String(settingsForm.advance_notice_days)}
                    onChange={(e) =>
                      setSettingsForm((f) => f && { ...f, advance_notice_days: Number(e.target.value) })
                    }
                  />
                  <Input
                    {...mt}
                    label="Carry-over deadline (MM-DD)"
                    value={settingsForm.carry_over_deadline}
                    onChange={(e) =>
                      setSettingsForm((f) => f && { ...f, carry_over_deadline: e.target.value })
                    }
                  />
                  <Input
                    {...mt}
                    label="Morning clock window"
                    value={settingsForm.clock_window_morning}
                    onChange={(e) =>
                      setSettingsForm((f) => f && { ...f, clock_window_morning: e.target.value })
                    }
                  />
                  <Input
                    {...mt}
                    type="number"
                    label="Vesting month (1-12)"
                    value={String(settingsForm.vesting_month)}
                    onChange={(e) =>
                      setSettingsForm((f) => f && { ...f, vesting_month: Number(e.target.value) })
                    }
                  />
                  <Input
                    {...mt}
                    type="number"
                    label="Vesting day"
                    value={String(settingsForm.vesting_day)}
                    onChange={(e) =>
                      setSettingsForm((f) => f && { ...f, vesting_day: Number(e.target.value) })
                    }
                  />
                  <div className="flex items-center justify-between rounded-sm border border-gray-100 bg-gray-50/80 px-4 py-3">
                    <span className="text-sm">Allow carry-over with approval</span>
                    <Switch
                      {...mt}
                      checked={settingsForm.allow_carry_over}
                      onChange={(e) =>
                        setSettingsForm((f) => f && { ...f, allow_carry_over: e.target.checked })
                      }
                    />
                  </div>
                </div>
                {settingsError ? (
                  <Typography {...mt} className="mt-3 text-sm text-red-600">
                    {settingsError}
                  </Typography>
                ) : null}
                <Button
                  {...mt}
                  size="sm"
                  className="mt-5 rounded-sm bg-moh-green"
                  loading={saveSettingsMutation.isPending}
                  onClick={() => saveSettingsMutation.mutate()}
                >
                  Save settings
                </Button>
              </Card>

              <Card {...mt} className="rounded-sm border border-ui-border p-5">
                <Typography {...mt} className="mb-4 text-sm font-bold uppercase text-moh-green">
                  Leave types
                </Typography>
                <div className="space-y-3">
                  {types.map((t) => (
                    <div
                      key={t.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-sm border border-gray-100 p-3"
                    >
                      <div>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-gray-500">{t.code}</p>
                        {t.eligibility_notes ? (
                          <p className="mt-1 text-xs text-gray-600">{t.eligibility_notes}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {canManageWorkflow ? (
                          <Select
                            {...mt}
                            label="Workflow"
                            value={t.workflow_profile_code ?? 'default'}
                            onChange={(v) =>
                              updateTypeWorkflowMutation.mutate({
                                id: t.id,
                                workflow_profile_code: (v as string) ?? 'default',
                              })
                            }
                            className="min-w-[180px]"
                          >
                            {workflowProfiles.map((profile) => (
                              <Option key={profile.code} value={profile.code}>
                                {profile.name}
                              </Option>
                            ))}
                          </Select>
                        ) : (
                          <Chip
                            {...mt}
                            size="sm"
                            value={t.workflow_profile_code ?? 'default'}
                            className="rounded-sm"
                          />
                        )}
                        <div className="flex flex-wrap gap-1">
                        {t.max_days_per_year ? (
                          <Chip {...mt} size="sm" value={`Max ${t.max_days_per_year}d/yr`} className="rounded-sm" />
                        ) : null}
                        {t.requires_hr_approval ? (
                          <Chip {...mt} size="sm" value="HR approval" color="amber" className="rounded-sm" />
                        ) : null}
                        <Chip
                          {...mt}
                          size="sm"
                          value={t.is_active ? 'Active' : 'Inactive'}
                          color={t.is_active ? 'green' : 'gray'}
                          className="rounded-sm"
                        />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <LeaveWorkflowPanel />

              <div className="grid gap-6 lg:grid-cols-2">
                <Card {...mt} className="rounded-sm border border-ui-border p-5">
                  <Typography {...mt} className="mb-4 text-sm font-bold uppercase text-moh-green">
                    Annual entitlements by grade
                  </Typography>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b text-xs uppercase text-gray-500">
                          <th className="py-2 pr-4">Grade</th>
                          <th className="py-2">Days / year</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entitlements.map((e) => (
                          <tr key={e.id} className="border-b border-gray-50">
                            <td className="py-2 pr-4 font-medium">{e.salary_grade}</td>
                            <td className="py-2">{e.days_per_year}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </div>
          ) : null}
        </QueryState>
      ) : null}

      {statementStaffId && tab !== 'statements' ? (
        <StatementModal
          statement={statementQuery.data}
          isLoading={statementQuery.isLoading}
          onClose={() => setStatementStaffId(null)}
        />
      ) : null}
    </div>
  )
}

function StatementPanel({
  statement,
  isLoading,
  isError,
  error,
  onRetry,
  year,
}: {
  statement?: LeaveStatement
  isLoading: boolean
  isError: boolean
  error: Error | null
  onRetry: () => void
  year: number
}) {
  return (
    <QueryState isLoading={isLoading} isError={isError} error={error} label="leave statement" variant="form" onRetry={onRetry}>
      {statement ? (
        <Card {...mt} className="rounded-sm border border-moh-green/15 p-5">
          <Typography {...mt} className="text-lg font-bold text-moh-green">
            {statement.staff_name} — {year} leave statement
          </Typography>
          <Typography {...mt} className="mt-1 text-sm text-gray-600">
            {statement.job_title} · {statement.department_name || statement.facility_name}
            {statement.salary_grade ? ` · Grade ${statement.salary_grade}` : ''}
          </Typography>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Entitled', value: statement.summary.total_entitled },
              { label: 'Used', value: statement.summary.total_used },
              { label: 'Remaining', value: statement.summary.total_remaining },
            ].map((item) => (
              <div key={item.label} className="rounded-sm bg-moh-green/5 px-4 py-3">
                <p className="text-xs uppercase text-gray-500">{item.label}</p>
                <p className="text-2xl font-bold text-moh-green">{item.value}</p>
              </div>
            ))}
          </div>

          <Typography {...mt} className="mt-6 mb-3 text-sm font-bold uppercase text-gray-700">
            Balances by leave type
          </Typography>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-gray-500">
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Entitled</th>
                  <th className="py-2 pr-4">Carried</th>
                  <th className="py-2 pr-4">Used</th>
                  <th className="py-2">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {statement.balances.length ? (
                  statement.balances.map((b) => (
                    <tr key={b.leave_type_id} className="border-b border-gray-50">
                      <td className="py-2 pr-4 font-medium">{b.leave_type_name}</td>
                      <td className="py-2 pr-4">{b.entitled_days}</td>
                      <td className="py-2 pr-4">{b.carried_over_days}</td>
                      <td className="py-2 pr-4">{b.used_days}</td>
                      <td className="py-2 font-medium text-moh-green">{b.remaining_days}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-gray-500">
                      No balance records for {year}. Use Initialize balances to create them from grade entitlements.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Typography {...mt} className="mt-6 mb-3 text-sm font-bold uppercase text-gray-700">
            Request history ({year})
          </Typography>
          <div className="space-y-2">
            {statement.requests.length ? (
              statement.requests.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-gray-100 px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium">{r.leave_type_name}</span> — {r.days_requested} days
                    <span className="ml-2 text-gray-500">
                      {r.start_date} → {r.end_date}
                    </span>
                  </div>
                  <Chip
                    {...mt}
                    size="sm"
                    value={r.status}
                    className="rounded-sm capitalize"
                    color={statusChipColor(r.status)}
                  />
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No leave requests recorded for this year.</p>
            )}
          </div>
        </Card>
      ) : null}
    </QueryState>
  )
}

function StatementModal({
  statement,
  isLoading,
  onClose,
}: {
  statement?: LeaveStatement
  isLoading: boolean
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <Card
        {...mt}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-sm p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <Typography {...mt} className="text-lg font-bold text-moh-green">
            Leave statement
          </Typography>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading statement…</p>
        ) : statement ? (
          <StatementPanel
            statement={statement}
            isLoading={false}
            isError={false}
            error={null}
            onRetry={() => {}}
            year={statement.year}
          />
        ) : null}
      </Card>
    </div>
  )
}

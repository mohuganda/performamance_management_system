import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Option, Select, Tab, Tabs, TabsHeader, Textarea, Typography } from '@material-tailwind/react'
import { getApiErrorMessage } from '@/api/client'
import { leavePlanService, type LeavePlanRow } from '@/api/services/leavePlan'
import { DatePickerField } from '@/components/molecules/DatePickerField'
import { FormStatusAlert, type FormStatusType } from '@/components/molecules/FormStatusAlert'
import { PageHeader } from '@/components/organisms/PageHeader'
import { QueryState } from '@/components/organisms/QueryState'
import { notifyApiError, toast } from '@/features/toast'
import { useAuthStore } from '@/stores/appStore'
import { mt } from '@/utils/mt'

type FormAlert = { type: FormStatusType; message: string; title?: string }

export function LeavePlanPage() {
  const queryClient = useQueryClient()
  const { hasPermission, staffId } = useAuthStore()
  const staffLinked = Boolean(staffId)
  const canManage = hasPermission('leave.plans.manage')
  const canViewTeam = hasPermission('leave.plans.view_team')

  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(String(currentYear))
  const [tab, setTab] = useState<'mine' | 'team'>('mine')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ start_date: '', end_date: '', notes: '' })
  const [formAlert, setFormAlert] = useState<FormAlert | null>(null)

  const yearNum = Number(year) || currentYear

  const mineQuery = useQuery({
    queryKey: ['leave-plans', 'mine', yearNum],
    queryFn: () => leavePlanService.listMine(yearNum),
    enabled: staffLinked && tab === 'mine',
  })

  const teamQuery = useQuery({
    queryKey: ['leave-plans', 'team', yearNum],
    queryFn: () => leavePlanService.listTeam(yearNum),
    enabled: staffLinked && canViewTeam && tab === 'team',
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        calendar_year: yearNum,
        start_date: form.start_date,
        end_date: form.end_date,
        notes: form.notes,
      }
      if (editingId) return leavePlanService.update(editingId, payload)
      return leavePlanService.create(payload)
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['leave-plans'] })
      setForm({ start_date: '', end_date: '', notes: '' })
      setEditingId(null)
      if (result.entitlement_warning) {
        const message = result.warning_message || 'Planned days exceed remaining annual entitlement.'
        setFormAlert({ type: 'warning', title: 'Saved with warning', message })
        toast.warning(message, 'Leave plan')
      } else {
        setFormAlert({
          type: 'success',
          title: 'Saved',
          message: 'Your leave plan block was saved. Apply via Leave when the time comes.',
        })
        toast.success('Leave plan saved')
      }
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error, 'Could not save leave plan')
      setFormAlert({ type: 'error', title: 'Could not save', message })
      notifyApiError(error, 'Could not save leave plan')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => leavePlanService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-plans'] })
      toast.success('Plan block removed')
    },
    onError: (error: unknown) => notifyApiError(error, 'Could not delete leave plan'),
  })

  const yearOptions = useMemo(() => [currentYear, currentYear + 1], [currentYear])

  const startEdit = (row: LeavePlanRow) => {
    setEditingId(row.id)
    setForm({ start_date: row.start_date, end_date: row.end_date, notes: row.notes || '' })
    setFormAlert(null)
  }

  const handleSave = () => {
    if (!form.start_date || !form.end_date) {
      setFormAlert({ type: 'warning', title: 'Check the form', message: 'Enter start and end dates.' })
      return
    }
    setFormAlert(null)
    saveMutation.mutate()
  }

  return (
    <div>
      <PageHeader
        title="Annual leave plan"
        subtitle="Plan intended annual leave for the year. This does not apply for leave — submit a leave request when ready."
      />

      <div className="mb-4 flex flex-col items-start gap-3">
        <div className="w-40">
          <Select
            {...mt}
            label="Year"
            value={year}
            onChange={(v) => {
              if (v) setYear(v)
            }}
            className="rounded-sm"
          >
            {yearOptions.map((y) => (
              <Option key={y} value={String(y)}>
                {y}
              </Option>
            ))}
          </Select>
        </div>
        <Link to="/leave" className="text-sm font-medium text-moh-green underline-offset-2 hover:underline">
          Go to leave applications →
        </Link>
      </div>

      {!staffLinked ? (
        <Card {...mt} className="rounded-sm border border-moh-warning/40 p-4">
          <Typography {...mt} className="text-sm text-moh-warning">
            Your account is not linked to a staff record. Contact HR before planning leave.
          </Typography>
        </Card>
      ) : null}

      {staffLinked && canViewTeam ? (
        <Tabs value={tab} className="mb-4">
          <TabsHeader
            {...mt}
            className="rounded-sm bg-ui-subtle p-1"
            indicatorProps={{ className: 'rounded-sm bg-white shadow-sm' }}
          >
            <Tab {...mt} value="mine" onClick={() => setTab('mine')} className="rounded-sm text-sm">
              My plan
            </Tab>
            <Tab {...mt} value="team" onClick={() => setTab('team')} className="rounded-sm text-sm">
              Team
            </Tab>
          </TabsHeader>
        </Tabs>
      ) : null}

      {staffLinked && tab === 'mine' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <QueryState
            isLoading={mineQuery.isLoading}
            isError={mineQuery.isError}
            error={mineQuery.error}
            label="leave plans"
            variant="cards"
            onRetry={() => mineQuery.refetch()}
          >
            <Card {...mt} className="rounded-sm border border-moh-green/15 p-4 lg:col-span-1">
              <Typography {...mt} className="mb-3 text-sm font-bold uppercase text-moh-green">
                Planned blocks ({yearNum})
              </Typography>
              {Array.isArray(mineQuery.data) && mineQuery.data.length > 0 ? (
                <ul className="space-y-3 text-sm">
                  {mineQuery.data.map((row) => (
                    <li key={row.id} className="rounded-sm border border-ui-border p-3">
                      <p className="font-semibold text-ui-text">
                        {row.start_date} – {row.end_date}
                      </p>
                      <p className="text-ui-muted">{row.days_planned} day(s)</p>
                      {row.notes ? <p className="mt-1 text-ui-text">{row.notes}</p> : null}
                      {canManage ? (
                        <div className="mt-2 flex gap-2">
                          <Button {...mt} size="sm" variant="outlined" className="rounded-sm" onClick={() => startEdit(row)}>
                            Edit
                          </Button>
                          <Button
                            {...mt}
                            size="sm"
                            variant="text"
                            className="rounded-sm text-red-600"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (window.confirm('Delete this planned leave block?')) {
                                deleteMutation.mutate(row.id)
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <Typography {...mt} className="text-sm text-ui-muted">
                  No planned leave for {yearNum} yet.
                </Typography>
              )}
            </Card>
          </QueryState>

          {canManage ? (
            <Card {...mt} className="rounded-sm border border-moh-green/15 p-4 lg:col-span-2">
              <Typography {...mt} className="mb-4 text-sm font-bold uppercase text-moh-green">
                {editingId ? 'Edit plan block' : 'Add plan block'}
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
              <div className="grid gap-4 md:grid-cols-2">
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
                  className="rounded-sm"
                />
                <div className="md:col-span-2">
                  <Textarea
                    {...mt}
                    label="Notes (optional)"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    className="rounded-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <Button
                    {...mt}
                    size="sm"
                    className="rounded-sm bg-moh-green"
                    loading={saveMutation.isPending}
                    onClick={handleSave}
                  >
                    {editingId ? 'Update block' : 'Save block'}
                  </Button>
                  {editingId ? (
                    <Button
                      {...mt}
                      size="sm"
                      variant="outlined"
                      className="rounded-sm"
                      onClick={() => {
                        setEditingId(null)
                        setForm({ start_date: '', end_date: '', notes: '' })
                      }}
                    >
                      Cancel edit
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      {staffLinked && tab === 'team' && canViewTeam ? (
        <QueryState
          isLoading={teamQuery.isLoading}
          isError={teamQuery.isError}
          error={teamQuery.error}
          label="team leave plans"
          variant="cards"
          onRetry={() => teamQuery.refetch()}
        >
          <Card {...mt} className="rounded-sm border border-moh-green/15 p-4">
            <Typography {...mt} className="mb-3 text-sm font-bold uppercase text-moh-green">
              Team plans ({yearNum})
            </Typography>
            {Array.isArray(teamQuery.data) && teamQuery.data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-ui-border text-xs uppercase text-ui-muted">
                      <th className="py-2 pr-3 font-semibold">Staff</th>
                      <th className="py-2 pr-3 font-semibold">Dates</th>
                      <th className="py-2 pr-3 font-semibold">Days</th>
                      <th className="py-2 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamQuery.data.map((row) => (
                      <tr key={row.id} className="border-b border-gray-100">
                        <td className="py-2 pr-3 font-medium">{row.staff_name || `Staff #${row.staff_id}`}</td>
                        <td className="py-2 pr-3">
                          {row.start_date} – {row.end_date}
                        </td>
                        <td className="py-2 pr-3">{row.days_planned}</td>
                        <td className="py-2 text-ui-muted">{row.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Typography {...mt} className="text-sm text-ui-muted">
                No team leave plans for {yearNum}.
              </Typography>
            )}
          </Card>
        </QueryState>
      ) : null}
    </div>
  )
}

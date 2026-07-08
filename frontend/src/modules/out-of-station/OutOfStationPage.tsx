import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Input, Option, Select, Textarea, Typography } from '@material-tailwind/react'
import { oosService } from '@/api/services/mobile'
import { PageHeader } from '@/components/organisms/PageHeader'
import { ProcessGuide } from '@/components/organisms/ProcessGuide'
import { QueryState } from '@/components/organisms/QueryState'
import { useAuthStore } from '@/stores/appStore'
import { mt } from '@/utils/mt'

const OOS_STEPS = [
  {
    title: 'Select reason and dates',
    description: 'Choose the official reason (training, field work, meeting, etc.) and travel dates.',
    actor: 'Employee',
  },
  {
    title: 'Set destination location',
    description:
      'Use “Use my current location” or enter GPS coordinates of where you will be working. This is used to verify attendance when you clock in away from your facility.',
    actor: 'Employee',
  },
  {
    title: 'Supervisor approval',
    description: 'Your supervisor approves the travel request before you go out of station.',
    actor: 'Supervisor',
  },
  {
    title: 'Clock attendance at destination',
    description:
      'While approved and out of station, clock in/out from the Attendance module — GPS must be within the approved destination area.',
    actor: 'Employee',
  },
]

export function OutOfStationPage() {
  const { hasPermission, staffId } = useAuthStore()
  const queryClient = useQueryClient()
  const canCreate = hasPermission('oos.requests.create')
  const canApprove = hasPermission('oos.requests.approve')

  const [form, setForm] = useState({
    reason_id: '',
    start_date: '',
    end_date: '',
    remarks: '',
    destination_name: '',
    destination_latitude: '',
    destination_longitude: '',
    submit: true,
  })
  const [approvalComment, setApprovalComment] = useState('')
  const [locating, setLocating] = useState(false)

  const reasonsQuery = useQuery({
    queryKey: ['oos', 'reasons'],
    queryFn: () => oosService.listReasons(),
  })

  const requestsQuery = useQuery({
    queryKey: ['oos', 'requests'],
    queryFn: () => oosService.listRequests(),
    enabled: Boolean(staffId),
  })

  const pendingQuery = useQuery({
    queryKey: ['oos', 'pending-approvals'],
    queryFn: () => oosService.listPendingApprovals(),
    enabled: Boolean(staffId) && canApprove,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      oosService.createRequest({
        reason_id: Number(form.reason_id),
        start_date: form.start_date,
        end_date: form.end_date,
        remarks: form.remarks,
        destination_name: form.destination_name,
        destination_latitude: Number(form.destination_latitude),
        destination_longitude: Number(form.destination_longitude),
        submit: form.submit,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oos'] })
      setForm({
        reason_id: '',
        start_date: '',
        end_date: '',
        remarks: '',
        destination_name: '',
        destination_latitude: '',
        destination_longitude: '',
        submit: true,
      })
    },
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, approve }: { id: number; approve: boolean }) =>
      oosService.approve(id, { approve, comments: approvalComment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oos'] })
      setApprovalComment('')
    },
  })

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          destination_latitude: String(pos.coords.latitude),
          destination_longitude: String(pos.coords.longitude),
        }))
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true },
    )
  }

  return (
    <div>
      <PageHeader
        title="Out of Station"
        subtitle="Apply for official travel and get supervisor approval before leaving your duty station"
      />

      <ProcessGuide title="How out-of-station application works" steps={OOS_STEPS} />

      {!staffId ? (
        <Card {...mt} className="rounded-sm border border-moh-warning/40 p-4">
          <Typography {...mt} className="text-sm text-moh-warning">
            Link your account to an iHRIS staff record to submit out-of-station requests.
          </Typography>
        </Card>
      ) : null}

      {canApprove && staffId ? (
        <QueryState
          isLoading={pendingQuery.isLoading}
          isError={pendingQuery.isError}
          error={pendingQuery.error}
          label="pending out-of-station approvals"
          onRetry={() => pendingQuery.refetch()}
        >
          <Card {...mt} className="mb-6 rounded-sm border border-uganda-yellow/50 bg-uganda-yellow/5 p-4">
            <Typography {...mt} className="mb-3 text-sm font-bold uppercase">
              Pending approvals — action required
            </Typography>
            {Array.isArray(pendingQuery.data) && pendingQuery.data.length > 0 ? (
              <div className="space-y-4">
                {pendingQuery.data.map(
                  (row: {
                    approval_id: number
                    staff_name: string
                    reason_name: string
                    start_date: string
                    end_date: string
                    destination: string
                  }) => (
                    <div
                      key={row.approval_id}
                      className="rounded-sm border border-ui-border bg-white p-3"
                    >
                      <p className="font-semibold">{row.staff_name}</p>
                      <p className="text-sm text-ui-muted">
                        {row.reason_name} · {row.start_date} – {row.end_date}
                      </p>
                      {row.destination ? (
                        <p className="text-sm">Destination: {row.destination}</p>
                      ) : null}
                      <div className="mt-2 flex gap-2">
                        <Button
                          {...mt}
                          size="sm"
                          className="rounded-sm bg-moh-green"
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
                No out-of-station requests waiting for your approval.
              </Typography>
            )}
          </Card>
        </QueryState>
      ) : null}

      {canCreate && staffId ? (
        <Card {...mt} className="mt-6 rounded-sm border border-moh-green/15 p-4">
          <Typography {...mt} className="mb-4 text-sm font-bold uppercase text-moh-green">
            New out-of-station application
          </Typography>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              createMutation.mutate()
            }}
          >
            <Select
              {...mt}
              label="Reason"
              value={form.reason_id}
              onChange={(v) => setForm((f) => ({ ...f, reason_id: v ?? '' }))}
            >
              {(Array.isArray(reasonsQuery.data) ? reasonsQuery.data : []).map(
                (r: { id: number; reason: string }) => (
                  <Option key={r.id} value={String(r.id)}>
                    {r.reason}
                  </Option>
                ),
              )}
            </Select>
            <Input
              {...mt}
              label="Destination name"
              value={form.destination_name}
              onChange={(e) => setForm((f) => ({ ...f, destination_name: e.target.value }))}
              placeholder="e.g. Kampala training centre"
            />
            <Input
              {...mt}
              type="date"
              label="Start date"
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
            />
            <Input
              {...mt}
              type="date"
              label="End date"
              value={form.end_date}
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
            />
            <Input
              {...mt}
              type="number"
              step="any"
              label="Latitude"
              value={form.destination_latitude}
              onChange={(e) => setForm((f) => ({ ...f, destination_latitude: e.target.value }))}
            />
            <Input
              {...mt}
              type="number"
              step="any"
              label="Longitude"
              value={form.destination_longitude}
              onChange={(e) => setForm((f) => ({ ...f, destination_longitude: e.target.value }))}
            />
            <div className="md:col-span-2">
              <Button
                {...mt}
                type="button"
                variant="outlined"
                size="sm"
                className="rounded-sm"
                onClick={useCurrentLocation}
                disabled={locating}
              >
                {locating ? 'Getting location...' : 'Use my current location'}
              </Button>
            </div>
            <div className="md:col-span-2">
              <Textarea
                {...mt}
                label="Remarks"
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              />
            </div>
            {createMutation.isError ? (
              <Typography {...mt} className="text-sm text-moh-error md:col-span-2">
                {(createMutation.error as Error).message}
              </Typography>
            ) : null}
            <Button
              {...mt}
              type="submit"
              className="rounded-sm bg-moh-green md:col-span-2"
              disabled={createMutation.isPending}
            >
              Submit for supervisor approval
            </Button>
          </form>
        </Card>
      ) : null}

      <QueryState
        isLoading={requestsQuery.isLoading}
        isError={requestsQuery.isError}
        error={requestsQuery.error}
        label="out-of-station requests"
        onRetry={() => requestsQuery.refetch()}
      >
        <Card {...mt} className="mt-6 rounded-sm border border-moh-green/15 p-4">
          <Typography {...mt} className="mb-3 text-sm font-bold uppercase text-moh-green">
            Request history
          </Typography>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                  <th className="py-2 pr-4">Reason</th>
                  <th className="py-2 pr-4">Period</th>
                  <th className="py-2 pr-4">Destination</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(requestsQuery.data) ? requestsQuery.data : []).map(
                  (row: Record<string, unknown>) => (
                    <tr key={String(row.id)} className="border-b border-gray-100">
                      <td className="py-2 pr-4">
                        {(Array.isArray(reasonsQuery.data)
                          ? reasonsQuery.data.find(
                              (r: { id: number }) => r.id === row.reason_id,
                            )?.reason
                          : null) ?? '—'}
                      </td>
                      <td className="py-2 pr-4">
                        {String(row.start_date).slice(0, 10)} – {String(row.end_date).slice(0, 10)}
                      </td>
                      <td className="py-2 pr-4 text-xs text-gray-600">
                        {String(row.destination_name ?? row.destination_latitude ?? '—')}
                      </td>
                      <td className="py-2 font-medium capitalize text-moh-green">
                        {String(row.status ?? 'pending')}
                      </td>
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

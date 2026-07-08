import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Typography } from '@material-tailwind/react'
import { MapPin } from 'lucide-react'
import { attendanceService } from '@/api/services/mobile'
import { PageHeader } from '@/components/organisms/PageHeader'
import { QueryState } from '@/components/organisms/QueryState'
import { useAuthStore } from '@/stores/appStore'
import { mt } from '@/utils/mt'

export function AttendancePage() {
  const { hasPermission, staffId } = useAuthStore()
  const queryClient = useQueryClient()
  const canClock = hasPermission('attendance.clock')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)

  const clocksQuery = useQuery({
    queryKey: ['attendance', 'clocks'],
    queryFn: () => attendanceService.listClocks(),
    enabled: hasPermission('attendance.view') && Boolean(staffId),
  })

  const clockMutation = useMutation({
    mutationFn: (action: 'in' | 'out') => {
      if (!coords) throw new Error('Location required. Capture GPS coordinates first.')
      return attendanceService.clock({
        action,
        latitude: coords.lat,
        longitude: coords.lng,
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance'] }),
  })

  const captureLocation = () => {
    setGeoError(null)
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError('Unable to retrieve location. Enable GPS and try again.'),
      { enableHighAccuracy: true },
    )
  }

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="GPS-verified clock in and out with attendance history"
      />

      {!staffId ? (
        <Card {...mt} className="rounded-sm border border-moh-warning/40 p-4">
          <Typography {...mt} className="text-sm text-moh-warning">
            Staff linkage required for attendance tracking.
          </Typography>
        </Card>
      ) : null}

      {canClock && staffId ? (
        <Card {...mt} className="mt-6 rounded-sm border border-moh-green/15 p-4">
          <Typography {...mt} className="mb-3 text-sm font-bold uppercase text-moh-green">
            Clock In / Out
          </Typography>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              {...mt}
              variant="outlined"
              className="flex items-center gap-2 rounded-sm border-moh-green/30 text-moh-green"
              onClick={captureLocation}
            >
              <MapPin className="h-4 w-4" />
              Capture GPS
            </Button>
            {coords ? (
              <Typography {...mt} className="text-xs text-gray-600">
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </Typography>
            ) : null}
            <Button
              {...mt}
              className="rounded-sm bg-moh-green"
              disabled={!coords || clockMutation.isPending}
              onClick={() => clockMutation.mutate('in')}
            >
              Clock In
            </Button>
            <Button
              {...mt}
              variant="outlined"
              className="rounded-sm border-uganda-red text-uganda-red"
              disabled={!coords || clockMutation.isPending}
              onClick={() => clockMutation.mutate('out')}
            >
              Clock Out
            </Button>
          </div>
          {geoError ? (
            <Typography {...mt} className="mt-2 text-sm text-moh-error">
              {geoError}
            </Typography>
          ) : null}
          {clockMutation.isError ? (
            <Typography {...mt} className="mt-2 text-sm text-moh-error">
              {(clockMutation.error as Error).message}
            </Typography>
          ) : null}
          {clockMutation.isSuccess ? (
            <Typography {...mt} className="mt-2 text-sm text-moh-success">
              Attendance recorded successfully.
            </Typography>
          ) : null}
        </Card>
      ) : null}

      <QueryState
        isLoading={clocksQuery.isLoading}
        isError={clocksQuery.isError}
        error={clocksQuery.error}
        label="attendance history"
        variant="table"
        onRetry={() => clocksQuery.refetch()}
      >
        <Card {...mt} className="mt-6 rounded-sm border border-moh-green/15 p-4">
          <Typography {...mt} className="mb-3 text-sm font-bold uppercase text-moh-green">
            Attendance History
          </Typography>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Coordinates</th>
                  <th className="py-2">Verified</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(clocksQuery.data) ? clocksQuery.data : []).map(
                  (row: Record<string, unknown>) => (
                    <tr key={String(row.id)} className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-medium capitalize">
                        {String(row.action ?? row.clock_type ?? '—')}
                      </td>
                      <td className="py-2 pr-4">{String(row.clocked_at ?? row.created_at ?? '—')}</td>
                      <td className="py-2 pr-4 text-xs">
                        {row.latitude != null && row.longitude != null
                          ? `${row.latitude}, ${row.longitude}`
                          : '—'}
                      </td>
                      <td className="py-2">
                        {row.verified || row.within_geofence ? (
                          <span className="text-moh-success">Yes</span>
                        ) : (
                          <span className="text-moh-warning">Pending</span>
                        )}
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

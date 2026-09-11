import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Typography } from '@material-tailwind/react'
import { format, parseISO, startOfDay } from 'date-fns'
import { MapPin } from 'lucide-react'
import {
  attendanceService,
  oosService,
  type AttendanceClockRow,
} from '@/api/services/mobile'
import { authService } from '@/api/services/auth'
import apiClient from '@/api/client'
import { Badge } from '@/components/atoms/Badge'
import { OosAttendanceMap } from '@/components/molecules/OosAttendanceMap'
import { SearchableSelect } from '@/components/molecules/SearchableSelect'
import { SegmentedTabs } from '@/components/molecules/SegmentedTabs'
import { PageHeader } from '@/components/organisms/PageHeader'
import { QueryState } from '@/components/organisms/QueryState'
import { notifyApiError, toast } from '@/features/toast'
import { useAuthStore } from '@/stores/appStore'
import { haversineMeters, locationAccuracyPercent } from '@/utils/geo'
import { mt } from '@/utils/mt'
import {
  formatRequestPeriod,
  pickField,
  pickString,
  requestStatus,
} from '@/utils/requestRow'

type Mode = 'station' | 'oos'

type Coords = { lat: number; lng: number; accuracy?: number }

type OosAttendanceSettings = {
  min_accuracy_percent: number
  default_geofence_radius_meters: number
}

function dateOnly(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  try {
    const d = raw.includes('T') ? parseISO(raw) : parseISO(raw.slice(0, 10))
    if (Number.isNaN(d.getTime())) return raw.slice(0, 10)
    return format(d, 'yyyy-MM-dd')
  } catch {
    return raw.slice(0, 10)
  }
}

function coversToday(row: Record<string, unknown>, today: string): boolean {
  const start = dateOnly(pickField(row, 'start_date', 'StartDate'))
  const end = dateOnly(pickField(row, 'end_date', 'EndDate'))
  if (!start || !end) return false
  return start <= today && end >= today
}

function statusLabel(status: string): string {
  switch (status) {
    case 'at_duty_station':
      return 'At duty station'
    case 'verified_oos':
      return 'Verified OOS'
    case 'outside_geofence':
      return 'Flagged (low accuracy)'
    case 'unverified_no_station_geo':
      return 'Unverified (no station pin)'
    default:
      return status.replace(/_/g, ' ') || '—'
  }
}

function statusTone(status: string): 'success' | 'warning' | 'error' | 'neutral' {
  if (status === 'verified_oos' || status === 'at_duty_station') return 'success'
  if (status === 'outside_geofence') return 'error'
  if (status === 'pending' || status === 'unverified_no_station_geo') return 'warning'
  return 'neutral'
}

export function AttendancePage() {
  const { hasPermission, staffId } = useAuthStore()
  const queryClient = useQueryClient()
  const canClock = hasPermission('attendance.clock')
  const canView = hasPermission('attendance.view')

  const [mode, setMode] = useState<Mode>('station')
  const [selectedOosId, setSelectedOosId] = useState<string>('')
  const [coords, setCoords] = useState<Coords | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)

  const today = format(startOfDay(new Date()), 'yyyy-MM-dd')

  const clocksQuery = useQuery({
    queryKey: ['attendance', 'clocks'],
    queryFn: () => attendanceService.listClocks(),
    enabled: canView && Boolean(staffId),
  })

  const oosQuery = useQuery({
    queryKey: ['oos', 'requests', 'attendance'],
    queryFn: () => oosService.listRequests(),
    enabled: Boolean(staffId) && (canClock || canView),
  })

  const settingsQuery = useQuery({
    queryKey: ['public-config', 'attendance-thresholds'],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        settings?: {
          oos_attendance?: Partial<OosAttendanceSettings>
          duty_station_attendance?: Partial<OosAttendanceSettings>
        }
      }>('/config')
      return {
        oos: {
          min_accuracy_percent: Number(data.settings?.oos_attendance?.min_accuracy_percent ?? 70),
          default_geofence_radius_meters: Number(
            data.settings?.oos_attendance?.default_geofence_radius_meters ?? 500,
          ),
        },
        duty: {
          min_accuracy_percent: Number(
            data.settings?.duty_station_attendance?.min_accuracy_percent ?? 90,
          ),
          default_geofence_radius_meters: Number(
            data.settings?.duty_station_attendance?.default_geofence_radius_meters ?? 500,
          ),
        },
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authService.me(),
    enabled: Boolean(staffId),
    staleTime: 60_000,
  })

  const oosMinAccuracy = settingsQuery.data?.oos.min_accuracy_percent ?? 70
  const oosDefaultRadius = settingsQuery.data?.oos.default_geofence_radius_meters ?? 500
  const stationMinAccuracy = settingsQuery.data?.duty.min_accuracy_percent ?? 90
  const stationDefaultRadius = settingsQuery.data?.duty.default_geofence_radius_meters ?? 500

  const effectiveStation = meQuery.data?.staff?.effective_duty_station
  const stationDestination =
    effectiveStation && effectiveStation.source !== 'none'
      ? {
          lat: effectiveStation.latitude,
          lng: effectiveStation.longitude,
          name: effectiveStation.label || meQuery.data?.staff?.facility_name || 'Duty station',
          radiusMeters: effectiveStation.radius_meters || stationDefaultRadius,
        }
      : null
  const approvedActiveRequests = useMemo(() => {
    const rows = Array.isArray(oosQuery.data) ? oosQuery.data : []
    return (rows as Record<string, unknown>[]).filter((row) => {
      const status = requestStatus(row).toLowerCase()
      return status === 'approved' && coversToday(row, today)
    })
  }, [oosQuery.data, today])

  const oosOptions = useMemo(
    () =>
      approvedActiveRequests.map((row) => {
        const id = String(pickField(row, 'id', 'ID') ?? '')
        const dest =
          pickString(row, 'destination_name', 'DestinationName') || 'Destination'
        return {
          value: id,
          label: dest,
          description: formatRequestPeriod(row),
        }
      }),
    [approvedActiveRequests],
  )

  const selectedRequest = useMemo(() => {
    if (!selectedOosId) return null
    return (
      approvedActiveRequests.find(
        (row) => String(pickField(row, 'id', 'ID') ?? '') === selectedOosId,
      ) ?? null
    )
  }, [approvedActiveRequests, selectedOosId])

  const destination = useMemo(() => {
    if (!selectedRequest) return null
    const lat = Number(
      pickField(selectedRequest, 'destination_latitude', 'DestinationLatitude'),
    )
    const lng = Number(
      pickField(selectedRequest, 'destination_longitude', 'DestinationLongitude'),
    )
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
      return null
    }
    const radiusRaw = Number(
      pickField(selectedRequest, 'geofence_radius_meters', 'GeofenceRadiusMeters'),
    )
    return {
      lat,
      lng,
      name: pickString(selectedRequest, 'destination_name', 'DestinationName') || 'Destination',
      radiusMeters: radiusRaw > 0 ? radiusRaw : oosDefaultRadius,
    }
  }, [selectedRequest, oosDefaultRadius])

  const activeDestination = mode === 'oos' ? destination : stationDestination

  const previewAccuracy = useMemo(() => {
    if (!coords || !activeDestination) return null
    const distance = haversineMeters(
      coords.lat,
      coords.lng,
      activeDestination.lat,
      activeDestination.lng,
    )
    return locationAccuracyPercent(distance, activeDestination.radiusMeters)
  }, [coords, activeDestination])

  const mapClocks = useMemo(() => {
    const rows = clocksQuery.data ?? []
    if (mode === 'oos') {
      const oosId = selectedOosId ? Number(selectedOosId) : null
      return rows
        .filter((row) => (oosId ? row.out_of_station_request_id === oosId : false))
        .map((row) => ({
          lat: row.latitude,
          lng: row.longitude,
          clock_type: row.clock_type,
          accuracy_percent: row.location_accuracy_percent,
          label: `${row.clock_type} · ${row.clocked_at}`,
        }))
    }
    return rows
      .filter((row) => !row.out_of_station_request_id)
      .slice(0, 20)
      .map((row) => ({
        lat: row.latitude,
        lng: row.longitude,
        clock_type: row.clock_type,
        accuracy_percent: row.location_accuracy_percent,
        label: `${row.clock_type} · ${row.clocked_at}`,
      }))
  }, [clocksQuery.data, selectedOosId, mode])

  const clockMutation = useMutation({
    mutationFn: (clockType: 'in' | 'out') => {
      if (!coords) throw new Error('Location required. Capture GPS coordinates first.')
      if (mode === 'oos' && !selectedOosId) {
        throw new Error('Select an approved out-of-station request covering today.')
      }
      return attendanceService.clock({
        clock_type: clockType,
        latitude: coords.lat,
        longitude: coords.lng,
        accuracy_meters: coords.accuracy,
        out_of_station_request_id:
          mode === 'oos' && selectedOosId ? Number(selectedOosId) : undefined,
      })
    },
    onSuccess: (clock, clockType) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      const pct =
        clock.location_accuracy_percent != null
          ? ` · ${Math.round(clock.location_accuracy_percent)}% accuracy`
          : ''
      const flagged = clock.verification_status === 'outside_geofence'
      toast.success(
        `Clock ${clockType} recorded${pct}${flagged ? ' (flagged below threshold)' : ''}.`,
        'Attendance',
      )
    },
    onError: (error: unknown) => notifyApiError(error, 'Could not record attendance'),
  })

  const captureLocation = () => {
    setGeoError(null)
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => setGeoError('Unable to retrieve location. Enable GPS and try again.'),
      { enableHighAccuracy: true, timeout: 20_000 },
    )
  }

  const clockDisabled =
    !coords ||
    clockMutation.isPending ||
    (mode === 'oos' && !selectedOosId)

  const historyRows: AttendanceClockRow[] = clocksQuery.data ?? []

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Clock at your duty station, or against an approved out-of-station destination"
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

          <SegmentedTabs
            className="mb-4 max-w-lg"
            tabs={[
              { value: 'station', label: 'At duty station' },
              { value: 'oos', label: 'Out of station', count: oosOptions.length },
            ]}
            value={mode}
            onChange={(value) => {
              setMode(value)
              if (value === 'station') setSelectedOosId('')
            }}
          />

          {mode === 'oos' ? (
            <div className="mb-4 max-w-lg space-y-2">
              <SearchableSelect
                label="Approved trip for today"
                value={selectedOosId}
                options={oosOptions}
                onChange={setSelectedOosId}
                placeholder="Select destination request…"
                emptyLabel={
                  oosQuery.isLoading
                    ? 'Loading requests…'
                    : 'No approved out-of-station request covers today'
                }
              />
              <Typography {...mt} className="text-xs text-ui-muted">
                You must choose a trip — clocks are not auto-linked. Pass mark is {oosMinAccuracy}%
                accuracy inside the destination geofence.
              </Typography>
            </div>
          ) : (
            <Typography {...mt} className="mb-4 text-xs text-ui-muted">
              Station clocks use your duty-station pin (Profile). Pass mark is {stationMinAccuracy}
              %. Source:{' '}
              {effectiveStation?.source === 'personal'
                ? 'personal override'
                : effectiveStation?.source === 'facility'
                  ? 'facility'
                  : 'not set — clock will be unverified until a pin exists'}
              .
            </Typography>
          )}

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
                {coords.accuracy != null ? ` (±${Math.round(coords.accuracy)}m)` : ''}
                {previewAccuracy != null ? ` · preview ${Math.round(previewAccuracy)}%` : ''}
              </Typography>
            ) : null}
            <Button
              {...mt}
              className="rounded-sm bg-moh-green"
              disabled={clockDisabled}
              onClick={() => clockMutation.mutate('in')}
            >
              Clock In
            </Button>
            <Button
              {...mt}
              variant="outlined"
              className="rounded-sm border-uganda-red text-uganda-red"
              disabled={clockDisabled}
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

          {mode === 'oos' && destination ? (
            <OosAttendanceMap
              className="mt-4"
              destination={destination}
              radiusMeters={destination.radiusMeters}
              clocks={mapClocks}
              current={coords}
              previewAccuracyPercent={previewAccuracy}
            />
          ) : null}

          {mode === 'station' && stationDestination ? (
            <OosAttendanceMap
              className="mt-4"
              destination={stationDestination}
              radiusMeters={stationDestination.radiusMeters}
              clocks={mapClocks}
              current={coords}
              previewAccuracyPercent={previewAccuracy}
            />
          ) : null}

          {mode === 'station' && !stationDestination ? (
            <Typography {...mt} className="mt-3 text-sm text-amber-800">
              No duty-station location yet—clock will be recorded as unverified until facility or
              personal pin is set on Profile.
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
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Accuracy</th>
                  <th className="py-2">Coordinates</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row) => {
                  const isOos = Boolean(row.out_of_station_request_id)
                  const threshold = isOos ? oosMinAccuracy : stationMinAccuracy
                  const flagged =
                    row.verification_status === 'outside_geofence' ||
                    (row.location_accuracy_percent != null &&
                      row.location_accuracy_percent < threshold)
                  return (
                    <tr key={row.id} className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-medium capitalize">
                        {row.clock_type || '—'}
                      </td>
                      <td className="py-2 pr-4">{row.clocked_at || '—'}</td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            label={statusLabel(row.verification_status)}
                            tone={statusTone(row.verification_status)}
                          />
                          {flagged ? <Badge label="Flagged" tone="error" /> : null}
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        {row.location_accuracy_percent != null
                          ? `${Math.round(row.location_accuracy_percent)}%`
                          : '—'}
                      </td>
                      <td className="py-2 text-xs">
                        {row.latitude != null && row.longitude != null
                          ? `${row.latitude}, ${row.longitude}`
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </QueryState>
    </div>
  )
}

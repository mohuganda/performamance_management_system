import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Info,
  ShieldCheck,
  Paperclip,
  Trash2,
  Undo2,
  Loader2,
} from 'lucide-react'
import { oosService, attendanceService } from '@/api/services/mobile'
import { useGoogleMapsApi } from '@/hooks/useGoogleMapsApi'
import { useGoogleMapsScript } from '@/hooks/useGoogleMapsScript'
import { haversineMeters } from '@/utils/geo'
import { toast, notifyApiError } from '@/features/toast'
import { cn } from '@/utils/cn'

const DEFAULT_GEOFENCE_RADIUS = 500

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateRange(start: string, end: string) {
  if (!start) return ''
  if (!end || start === end) return formatDate(start)
  return `${formatDate(start)} to ${formatDate(end)}`
}

export function OutOfStationDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // Google Maps setup
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const destMarkerRef = useRef<any>(null)
  const userMarkerRef = useRef<any>(null)
  const circleRef = useRef<any>(null)

  const { apiKey, ready: keyReady } = useGoogleMapsApi()
  const { ready: scriptReady } = useGoogleMapsScript(keyReady ? apiKey : '')

  // GPS / Geolocation State
  const [coords, setCoords] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [notes, setNotes] = useState('')

  // Queries
  const requestQuery = useQuery({
    queryKey: ['oos', 'request', id],
    queryFn: () => oosService.getRequest(Number(id)),
    enabled: Boolean(id),
  })

  const reasonsQuery = useQuery({
    queryKey: ['oos', 'reasons'],
    queryFn: () => oosService.listReasons(),
  })

  const clocksQuery = useQuery({
    queryKey: ['attendance', 'clocks'],
    queryFn: () => attendanceService.listClocks(),
  })

  const rawReq = requestQuery.data?.data || requestQuery.data

  const request = useMemo(() => {
    if (!rawReq || typeof rawReq !== 'object') return null
    const r = rawReq as Record<string, any>
    return {
      id: r.id ?? r.ID ?? id,
      remote_id: r.remote_id ?? r.RemoteID ?? r.id ?? r.ID ?? id,
      reason_id: r.reason_id ?? r.ReasonID,
      reason_name: r.reason_name ?? r.ReasonName ?? r.reason,
      start_date: r.start_date ?? r.StartDate ?? '',
      end_date: r.end_date ?? r.EndDate ?? '',
      destination_name: r.destination_name ?? r.DestinationName ?? '',
      destination_address: r.destination_address ?? r.DestinationAddress ?? '',
      destination_latitude: Number(r.destination_latitude ?? r.DestinationLatitude ?? 0),
      destination_longitude: Number(r.destination_longitude ?? r.DestinationLongitude ?? 0),
      geofence_radius_meters: Number(r.geofence_radius_meters ?? r.GeofenceRadiusMeters ?? DEFAULT_GEOFENCE_RADIUS),
      expected_deliverables: r.expected_deliverables ?? r.ExpectedDeliverables ?? '',
      remarks: r.remarks ?? r.Remarks ?? '',
      attachment_url: r.attachment_url ?? r.AttachmentURL ?? '',
      status: String(r.status ?? r.Status ?? 'pending').toLowerCase(),
    }
  }, [rawReq, id])

  const reasonLabel = useMemo(() => {
    if (!request) return ''
    if (request.reason_name) return request.reason_name
    const list = Array.isArray(reasonsQuery.data)
      ? reasonsQuery.data
      : (reasonsQuery.data as { data?: any[] })?.data
    if (Array.isArray(list)) {
      const found = list.find((item: any) => String(item.id ?? item.ID) === String(request.reason_id))
      if (found) return found.reason ?? found.Reason
    }
    return 'Travel Duty Assignment'
  }, [request, reasonsQuery.data])

  // Determine current active shift status specifically for this out-of-station request
  const isClockedIn = useMemo(() => {
    if (!clocksQuery.data || !request) return false
    const logs = Array.isArray(clocksQuery.data) ? clocksQuery.data : []
    const oosClocks = logs
      .filter((log: any) => String(log.out_of_station_request_id) === String(request.id) || String(log.out_of_station_request_id) === String(request.remote_id))
      .sort((a: any, b: any) => new Date(b.clocked_at || 0).getTime() - new Date(a.clocked_at || 0).getTime())
    const latest = oosClocks[0]
    if (!latest) return false
    const clockAction = latest.action || latest.clock_type
    return clockAction?.toLowerCase() === 'in'
  }, [clocksQuery.data, request])

  // Capture GPS position
  const fetchLocation = useCallback(() => {
    if (!navigator.geolocation) return
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setIsLocating(false)
      },
      (err) => {
        console.warn('GPS location error:', err)
        setIsLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    )
  }, [])

  useEffect(() => {
    fetchLocation()
  }, [fetchLocation])

  const destinationCoords = useMemo(() => {
    if (request && request.destination_latitude && request.destination_longitude) {
      return {
        latitude: request.destination_latitude,
        longitude: request.destination_longitude,
      }
    }
    return { latitude: 0.3476, longitude: 32.5825 } // Kampala default
  }, [request])

  const radius = request?.geofence_radius_meters || DEFAULT_GEOFENCE_RADIUS

  const { distanceMeters, isWithinGeofence } = useMemo(() => {
    if (!coords || !request || !request.destination_latitude || !request.destination_longitude) {
      return { distanceMeters: null, isWithinGeofence: false }
    }
    const dist = haversineMeters(
      coords.latitude,
      coords.longitude,
      destinationCoords.latitude,
      destinationCoords.longitude,
    )
    return {
      distanceMeters: dist,
      isWithinGeofence: dist <= radius,
    }
  }, [coords, request, destinationCoords, radius])

  // Clock Mutation
  const clockMutation = useMutation({
    mutationFn: (action: 'in' | 'out') =>
      attendanceService.clock({
        clock_type: action,
        latitude: coords?.latitude || 0,
        longitude: coords?.longitude || 0,
        accuracy_meters: coords?.accuracy || 0,
        location_label: request?.destination_name,
        out_of_station_request_id: Number(request?.remote_id || request?.id),
      }),
    onSuccess: (_data, action) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      toast.success(
        action === 'in'
          ? `Clocked in for ${request?.destination_name}`
          : `Clocked out from ${request?.destination_name}`,
        'Duty Attendance',
      )
      setNotes('')
    },
    onError: (err: unknown) => {
      notifyApiError(err, 'Failed to process attendance clock')
    },
  })

  // Recall Mutation
  const recallMutation = useMutation({
    mutationFn: () => oosService.recallRequest(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oos'] })
      toast.success('Request recalled to draft.', 'Travel')
    },
    onError: (err) => notifyApiError(err, 'Could not recall request'),
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: () => oosService.deleteRequest(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oos'] })
      toast.success('Request deleted.', 'Travel')
      navigate('/out-of-station')
    },
    onError: (err) => notifyApiError(err, 'Could not delete request'),
  })

  const handleClockAction = (clockType: 'in' | 'out') => {
    if (!coords) {
      fetchLocation()
      toast.info('Acquiring high-accuracy GPS position. Please try again.', 'GPS')
      return
    }
    if (clockType === 'in' && !isWithinGeofence) {
      toast.warning(
        `You are ${(distanceMeters! / 1000).toFixed(1)}km away. You must be within ${radius}m of ${request?.destination_name} to clock in.`,
        'Geofence Warning',
      )
      return
    }
    clockMutation.mutate(clockType)
  }

  // Update map canvas
  useEffect(() => {
    if (!scriptReady || !mapContainerRef.current || !request || !window.google?.maps) return

    const maps = window.google.maps
    const destPos = { lat: destinationCoords.latitude, lng: destinationCoords.longitude }

    if (!mapInstanceRef.current) {
      const map = new maps.Map(mapContainerRef.current, {
        center: destPos,
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      })
      mapInstanceRef.current = map

      const destMarker = new maps.Marker({
        position: destPos,
        map,
        title: request.destination_name,
      })
      destMarkerRef.current = destMarker

      const circle = new maps.Circle({
        map,
        center: destPos,
        radius,
        fillColor: isWithinGeofence ? 'rgba(34, 197, 94, 0.20)' : 'rgba(59, 130, 246, 0.15)',
        strokeColor: isWithinGeofence ? '#15803D' : '#3B82F6',
        strokeWeight: 1.5,
      })
      circleRef.current = circle
    } else {
      mapInstanceRef.current.setCenter(destPos)
      if (destMarkerRef.current) destMarkerRef.current.setPosition(destPos)
      if (circleRef.current) {
        circleRef.current.setCenter(destPos)
        circleRef.current.setRadius(radius)
        circleRef.current.setOptions({
          fillColor: isWithinGeofence ? 'rgba(34, 197, 94, 0.20)' : 'rgba(59, 130, 246, 0.15)',
          strokeColor: isWithinGeofence ? '#15803D' : '#3B82F6',
        })
      }
    }

    // User location marker
    if (coords) {
      const userPos = { lat: coords.latitude, lng: coords.longitude }
      if (!userMarkerRef.current) {
        userMarkerRef.current = new maps.Marker({
          position: userPos,
          map: mapInstanceRef.current,
          title: 'You',
          label: { text: 'You', color: '#0b4f4a', fontWeight: '700', fontSize: '11px' },
        })
      } else {
        userMarkerRef.current.setPosition(userPos)
      }
    }
  }, [scriptReady, request, destinationCoords, coords, isWithinGeofence, radius])

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'approved':
        return {
          bg: 'bg-green-500/10 dark:bg-green-500/20',
          border: 'border-green-500/30',
          text: 'text-green-700 dark:text-green-400',
          Icon: CheckCircle2,
          label: t('oos_approved_status', 'Approved'),
        }
      case 'rejected':
        return {
          bg: 'bg-red-500/10 dark:bg-red-500/20',
          border: 'border-red-500/30',
          text: 'text-red-700 dark:text-red-400',
          Icon: AlertTriangle,
          label: t('oos_rejected_status', 'Rejected'),
        }
      case 'draft':
        return {
          bg: 'bg-gray-500/10 dark:bg-gray-500/20',
          border: 'border-gray-500/30',
          text: 'text-gray-700 dark:text-gray-400',
          Icon: Clock,
          label: t('oos_draft_status', 'Draft'),
        }
      default:
        return {
          bg: 'bg-amber-500/10 dark:bg-amber-500/20',
          border: 'border-amber-500/30',
          text: 'text-amber-700 dark:text-amber-400',
          Icon: Clock,
          label: t('oos_pending_status', 'Pending'),
        }
    }
  }

  if (requestQuery.isLoading) {
    return (
      <div className="flex-1 justify-center items-center py-20 flex flex-col text-center">
        <Loader2 size={24} className="animate-spin text-emerald-600 mb-3" />
        <p className="text-xs text-ui-muted font-medium">
          {t('oos_loading_details', 'Loading travel details...')}
        </p>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-ui-muted">Travel request not found.</p>
        <button
          type="button"
          onClick={() => navigate('/out-of-station')}
          className="mt-4 px-4 py-2 bg-ui-surface border border-ui-border text-xs font-bold"
        >
          Back to History
        </button>
      </div>
    )
  }

  const statusStyle = getStatusStyles(request.status)
  const StatusIcon = statusStyle.Icon
  const isApproved = request.status === 'approved'

  return (
    <div className="flex-1 px-4 py-3 max-w-3xl mx-auto w-full pb-16">
      {/* Top Navigation Header matching Mobile */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-ui-border">
        <button
          type="button"
          onClick={() => navigate('/out-of-station')}
          className="p-1.5 hover:bg-ui-subtle rounded-none text-ui-text transition-colors cursor-pointer"
          title="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-base font-bold text-ui-text">
          {t('oos_details_title', 'Out-of-Station Duty')}
        </h1>
      </div>

      {/* Top Header Card */}
      <div className="p-4 mb-4 border border-ui-border bg-ui-surface shadow-sm rounded-none">
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-lg font-bold text-ui-text flex-1 mr-2 leading-tight">
            {reasonLabel}
          </h2>
          <div
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 border shrink-0',
              statusStyle.bg,
              statusStyle.border,
            )}
          >
            <StatusIcon size={12} className={statusStyle.text} />
            <span className={cn('text-[10px] font-bold capitalize', statusStyle.text)}>
              {statusStyle.label}
            </span>
          </div>
        </div>

        {/* Travel Period */}
        <div className="flex items-center gap-2 mt-1">
          <Calendar size={14} className="text-ui-muted shrink-0" />
          <span className="text-xs font-semibold text-ui-muted">
            {formatDateRange(request.start_date, request.end_date)}
          </span>
        </div>
      </div>

      {/* Map & Geofence Visualizer Card */}
      <div className="border border-ui-border bg-ui-surface shadow-sm rounded-none overflow-hidden mb-4">
        <div className="h-56 w-full relative bg-zinc-100 dark:bg-zinc-800">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Live GPS Refresh Pill on Map */}
          <button
            type="button"
            onClick={fetchLocation}
            disabled={isLocating}
            className="absolute top-3 right-3 bg-ui-surface border border-ui-border px-3 py-1.5 flex items-center gap-1.5 shadow-md text-xs font-bold text-ui-text cursor-pointer transition-colors"
          >
            {isLocating ? (
              <Loader2 size={12} className="animate-spin text-emerald-600" />
            ) : (
              <RefreshCw size={12} className="text-emerald-600" />
            )}
            <span className="text-[11px]">
              {isLocating
                ? t('oos_gps_locating', 'Locating...')
                : t('oos_gps_refresh', 'Locate Me')}
            </span>
          </button>
        </div>

        {/* Proximity HUD Banner matching Mobile */}
        <div
          className="p-3 flex items-center justify-between border-t border-ui-border"
          style={{
            backgroundColor: isWithinGeofence
              ? 'rgba(34, 197, 94, 0.08)'
              : 'rgba(245, 158, 11, 0.08)',
          }}
        >
          <div className="flex items-center gap-2 flex-1 pr-2">
            {isWithinGeofence ? (
              <ShieldCheck size={18} className="text-green-600 shrink-0" />
            ) : (
              <AlertTriangle size={18} className="text-amber-600 shrink-0" />
            )}
            <div className="flex-1">
              <p
                className={cn(
                  'text-xs font-bold',
                  isWithinGeofence ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400',
                )}
              >
                {isWithinGeofence
                  ? t('oos_geofence_inside', 'Inside Destination Zone')
                  : t('oos_geofence_outside', 'Outside Destination Zone')}
              </p>
              <p className="text-[11px] mt-0.5 text-ui-muted">
                {distanceMeters !== null
                  ? isWithinGeofence
                    ? `${Math.round(distanceMeters)}m from target (Within ${radius}m limit)`
                    : `${(distanceMeters / 1000).toFixed(1)} km away — Must be within ${radius}m to clock in`
                  : t('oos_acquiring_gps', 'Acquiring GPS position...')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Destination Information Card */}
      <div className="p-4 mb-4 border border-ui-border bg-ui-surface shadow-sm rounded-none">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3 text-ui-muted">
          {t('oos_destination_details', 'Destination Details')}
        </h3>

        <div className="flex items-start gap-2.5 mb-3">
          <MapPin size={16} className="text-emerald-700 dark:text-emerald-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-ui-text">{request.destination_name}</p>
            {request.destination_address && (
              <p className="text-xs mt-0.5 text-ui-muted">{request.destination_address}</p>
            )}
          </div>
        </div>

        {request.expected_deliverables && (
          <div className="mt-3 pt-3 border-t border-ui-border/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ui-muted">
              {t('oos_form_deliverables', 'Expected Deliverables')}
            </p>
            <p className="text-xs mt-1 text-ui-text leading-relaxed">
              {request.expected_deliverables}
            </p>
          </div>
        )}

        {request.remarks && (
          <div className="mt-3 pt-3 border-t border-ui-border/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ui-muted">
              {t('oos_form_remarks', 'Remarks')}
            </p>
            <p className="text-xs mt-1 text-ui-text leading-relaxed">
              {request.remarks}
            </p>
          </div>
        )}

        {request.attachment_url && (
          <div className="mt-3 pt-3 border-t border-ui-border/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ui-muted mb-1">
              {t('oos_form_supporting_docs', 'Supporting Travel Documents')}
            </p>
            <a
              href={request.attachment_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              <Paperclip size={12} />
              <span>View Attached Document</span>
            </a>
          </div>
        )}
      </div>

      {/* Duty Attendance Action Center */}
      <div className="p-4 mb-6 border border-ui-border bg-ui-surface shadow-sm rounded-none">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3 text-ui-muted">
          {t('oos_duty_attendance', 'Duty Attendance')}
        </h3>

        {!isApproved ? (
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-ui-border flex items-start gap-2">
            <Info size={16} className="text-ui-muted shrink-0 mt-0.5" />
            <p className="text-xs text-ui-muted flex-1 leading-relaxed">
              {t(
                'oos_attendance_requires_approval',
                'Duty clock-in will be enabled once your supervisor approves this travel request.',
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Active Shift Indicator */}
            {isClockedIn && (
              <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-500/30 flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                <p className="text-xs font-bold text-green-700 dark:text-green-400 flex-1">
                  {t('oos_currently_on_shift', 'You are currently clocked in on active duty.')}
                </p>
              </div>
            )}

            {/* Optional Notes Input */}
            <div className="mb-2">
              <label className="block text-xs font-medium mb-1 text-ui-muted">
                {t('attendance_notes_label', 'Notes / Remarks (Optional)')}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t(
                  'attendance_notes_placeholder',
                  'Add optional notes for this duty log...',
                )}
                className="w-full p-2.5 border border-ui-border bg-ui-surface text-xs text-ui-text rounded-none focus:outline-none focus:border-emerald-600"
              />
            </div>

            {/* Action Buttons */}
            {isClockedIn ? (
              <button
                type="button"
                onClick={() => handleClockAction('out')}
                disabled={clockMutation.isPending}
                className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-none transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {clockMutation.isPending
                  ? 'Processing...'
                  : t('attendance_btn_clock_out', 'Clock Out from Duty Station')}
              </button>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => handleClockAction('in')}
                  disabled={!isWithinGeofence || clockMutation.isPending}
                  className="w-full py-3 px-4 bg-[#15803D] hover:bg-[#15803D]/90 text-white font-bold text-xs rounded-none transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {clockMutation.isPending
                    ? 'Processing...'
                    : t('oos_btn_clock_in', 'Clock In for Out-of-Station Duty')}
                </button>
                {!isWithinGeofence && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center mt-2">
                    {t(
                      'oos_clockin_locked_desc',
                      'Clock-in is locked until you are within 500m of the destination.',
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Web Management Actions (Recall / Delete) */}
      {(request.status === 'pending' || request.status === 'draft' || request.status === 'rejected') && (
        <div className="flex gap-3 pt-2 border-t border-ui-border">
          {request.status === 'pending' && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Recall this request to draft?')) {
                  recallMutation.mutate()
                }
              }}
              disabled={recallMutation.isPending}
              className="flex-1 py-2 px-3 border border-ui-border hover:bg-ui-subtle text-xs font-semibold text-ui-text flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Undo2 size={14} />
              <span>Recall to Draft</span>
            </button>
          )}

          {(request.status === 'draft' || request.status === 'rejected') && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Delete this request permanently?')) {
                  deleteMutation.mutate()
                }
              }}
              disabled={deleteMutation.isPending}
              className="flex-1 py-2 px-3 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Trash2 size={14} />
              <span>Delete Request</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

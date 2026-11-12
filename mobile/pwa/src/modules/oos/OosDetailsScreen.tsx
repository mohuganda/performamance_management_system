import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  MapPin,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Clock,
  Info,
  Paperclip,
} from 'lucide-react';
import { AppBar } from '../../components/organisms/AppBar';
import { Card } from '../../components/atoms/Card';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { MapCard } from '../../components/molecules/MapCard';
import { useTheme } from '../../hooks/useTheme';
import { Toaster } from '../../utils/toast';
import { getApiErrorMessage } from '../../api/client';
import { useOosRequestsQuery, useOosReasonsQuery } from '../../hooks/useOos';
import { useClockMutation, useAttendanceListQuery } from '../../hooks/useAttendance';
import { ClockRequest } from '../../api/attendance/types';
import { getDistanceMeters } from '../../utils/haversine';
import { formatDate } from '../../utils/date';

function formatDateRange(start: string, end: string) {
  if (!start) return '';
  if (!end || start === end) return formatDate(start);
  return `${formatDate(start)} to ${formatDate(end)}`;
}

export const OosDetailsScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { colors } = useTheme();

  // Custom TanStack Query hooks
  const { data: requests = [], isLoading: isLoadingRequests } = useOosRequestsQuery();
  const { data: reasons = [] } = useOosReasonsQuery();
  const { data: attendanceLogs = [] } = useAttendanceListQuery();

  const request = useMemo(() => requests.find((r) => String(r.id) === String(id)), [requests, id]);
  const clockMutation = useClockMutation();

  // GPS Location & Proximity State
  const [coords, setCoords] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // Reason Name lookup
  const reasonLabel = useMemo(() => {
    if (!request) return '';
    if (request.reason_name) return request.reason_name;
    const found = reasons.find((r) => r.id === request.reason_id);
    if (found) return found.reason;
    return 'Travel Duty Assignment';
  }, [request, reasons]);

  // Determine current active shift status specifically for this out-of-station request
  const isClockedIn = useMemo(() => {
    if (!attendanceLogs || attendanceLogs.length === 0 || !request) return false;
    const oosClocks = [...attendanceLogs]
      .filter((log) => String(log.out_of_station_request_id) === String(request.id))
      .sort((a, b) => new Date(b.clocked_at || 0).getTime() - new Date(a.clocked_at || 0).getTime());
    const latest = oosClocks[0];
    if (!latest) return false;
    const clockAction = latest.action || (latest as any).clock_type;
    return clockAction?.toLowerCase() === 'in';
  }, [attendanceLogs, request]);

  const fetchLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        setGeoError(err.message || 'GPS Signal lost.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  // Destination coordinates
  const destinationCoords = useMemo(() => {
    if (!request) return { latitude: 0.3476, longitude: 32.5825 };
    return {
      latitude: request.destination_latitude || 0.3476,
      longitude: request.destination_longitude || 32.5825,
      name: request.destination_name,
    };
  }, [request]);

  const radius = request?.geofence_radius_meters || 500;

  // Haversine Proximity Calculation
  const { distanceMeters, isWithinGeofence } = useMemo(() => {
    if (!coords || !request) return { distanceMeters: null, isWithinGeofence: false };

    const dist = getDistanceMeters(
      coords.latitude,
      coords.longitude,
      destinationCoords.latitude,
      destinationCoords.longitude
    );

    return {
      distanceMeters: dist,
      isWithinGeofence: dist <= radius,
    };
  }, [coords, request, destinationCoords, radius]);

  const handleClockAction = async (clockType: 'in' | 'out') => {
    if (!coords) {
      Toaster.error('Acquiring high-accuracy GPS. Please ensure location is enabled.');
      fetchLocation();
      return;
    }

    if (clockType === 'in' && !isWithinGeofence) {
      Toaster.warning(
        `You are ${(distanceMeters! / 1000).toFixed(1)}km away. You must be within ${radius}m of ${request?.destination_name} to clock in.`
      );
      return;
    }

    const payload: ClockRequest = {
      action: clockType,
      clock_type: clockType,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy_meters: coords.accuracy,
      location_label: request?.destination_name,
      out_of_station_request_id: Number(id),
      notes: notes.trim() || undefined,
      clocked_at: new Date().toISOString(),
    };

    clockMutation.mutate(payload, {
      onSuccess: () => {
        Toaster.success(
          clockType === 'in'
            ? `Clocked in for ${request?.destination_name}`
            : `Clocked out from ${request?.destination_name}`
        );
        setNotes('');
      },
      onError: (err) => {
        Toaster.error(getApiErrorMessage(err, 'Failed to process attendance clock.'));
      },
    });
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'approved':
        return {
          bg: 'bg-green-500/10 dark:bg-green-500/20',
          border: 'border-green-500/30',
          text: 'text-green-700 dark:text-green-400',
          Icon: CheckCircle2,
          color: colors.success,
          label: t('oos_approved_status', 'Approved'),
        };
      case 'rejected':
        return {
          bg: 'bg-red-500/10 dark:bg-red-500/20',
          border: 'border-red-500/30',
          text: 'text-red-700 dark:text-red-400',
          Icon: AlertTriangle,
          color: colors.error,
          label: t('oos_rejected_status', 'Rejected'),
        };
      case 'pending_sync':
        return {
          bg: 'bg-blue-500/10 dark:bg-blue-500/20',
          border: 'border-blue-500/30',
          text: 'text-blue-700 dark:text-blue-400',
          Icon: RefreshCw,
          color: '#3B82F6',
          label: t('oos_pending_sync_status', 'Pending Sync'),
        };
      case 'sync_failed':
        return {
          bg: 'bg-red-500/10 dark:bg-red-500/20',
          border: 'border-red-500/30',
          text: 'text-red-700 dark:text-red-400',
          Icon: AlertTriangle,
          color: colors.error,
          label: t('oos_sync_failed_status', 'Sync Failed'),
        };
      case 'draft':
        return {
          bg: 'bg-gray-500/10 dark:bg-gray-500/20',
          border: 'border-gray-500/30',
          text: 'text-gray-700 dark:text-gray-400',
          Icon: Clock,
          color: colors.muted,
          label: t('oos_draft_status', 'Draft'),
        };
      default:
        return {
          bg: 'bg-amber-500/10 dark:bg-amber-500/20',
          border: 'border-amber-500/30',
          text: 'text-amber-700 dark:text-amber-400',
          Icon: Clock,
          color: colors.warning,
          label: t('oos_pending_status', 'Pending'),
        };
    }
  };

  if (isLoadingRequests && !request) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
        <AppBar title={t('oos_details_title', 'Out-of-Station Duty')} showBack />
        <div className="flex-1 flex items-center justify-center p-6 text-xs text-zinc-400">
          <RefreshCw size={20} className="animate-spin mr-2" />
          <span>{t('oos_loading_details', 'Loading travel details...')}</span>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
        <AppBar title={t('oos_details_title', 'Out-of-Station Duty')} showBack />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Assignment Not Found</p>
          <Button title="Back to Travel List" className="mt-4" onClick={() => navigate('/oos')} />
        </div>
      </div>
    );
  }

  const isApproved = request.status === 'approved';
  const statusStyle = getStatusStyles(request.status);
  const StatusIcon = statusStyle.Icon;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20">
      <AppBar title={t('oos_details_title', 'Out-of-Station Duty')} showBack />

      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* Top Header Card matching Mobile */}
        <Card className="p-4 space-y-2">
          <div className="flex items-start justify-between">
            <h2 className="text-lg font-bold flex-1 mr-2" style={{ color: colors.text }}>
              {reasonLabel}
            </h2>
            <div
              className={`flex items-center gap-1 px-2.5 py-1 border ${statusStyle.bg} ${statusStyle.border}`}
            >
              <StatusIcon size={12} color={statusStyle.color} />
              <span className={`text-[10px] font-bold capitalize ${statusStyle.text}`}>
                {statusStyle.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs" style={{ color: colors.muted }}>
            <Calendar size={13} />
            <span className="font-semibold">
              {formatDateRange(request.start_date, request.end_date)}
            </span>
          </div>
        </Card>

        {/* Map & Geofence Visualizer Card */}
        <div className="space-y-0">
          <MapCard
            coords={coords}
            targetCoords={destinationCoords}
            geofenceRadius={radius}
            isLocating={isLocating}
            geoError={geoError}
            onRefreshGps={fetchLocation}
            heightClass="h-56"
          />

          {/* Proximity HUD Banner matching Mobile */}
          <div
            className={`p-3 border -mt-4 mb-4 flex items-center justify-between ${
              isWithinGeofence
                ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900 text-green-800 dark:text-green-300'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {isWithinGeofence ? (
                <ShieldCheck size={20} className="text-green-600 flex-shrink-0" />
              ) : (
                <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
              )}
              <div className="text-xs leading-tight">
                <p className="font-bold">
                  {isWithinGeofence
                    ? t('oos_geofence_inside', 'Inside Destination Zone')
                    : t('oos_geofence_outside', 'Outside Destination Zone')}
                </p>
                <p className="text-[11px] opacity-80 mt-0.5">
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
        <Card className="p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.muted }}>
            {t('oos_destination_details', 'Destination Details')}
          </h3>

          <div className="flex items-start gap-2.5">
            <MapPin size={16} className="text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: colors.text }}>
                {request.destination_name}
              </p>
              {request.destination_address && (
                <p className="text-xs mt-0.5" style={{ color: colors.muted }}>
                  {request.destination_address}
                </p>
              )}
            </div>
          </div>

          {request.expected_deliverables && (
            <div className="pt-2 border-t" style={{ borderColor: `${colors.border}60` }}>
              <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: colors.muted }}>
                {t('oos_form_deliverables', 'Expected Deliverables')}
              </span>
              <p className="text-xs mt-1" style={{ color: colors.text }}>
                {request.expected_deliverables}
              </p>
            </div>
          )}

          {request.remarks && (
            <div className="pt-2 border-t" style={{ borderColor: `${colors.border}60` }}>
              <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: colors.muted }}>
                {t('oos_form_remarks', 'Remarks')}
              </span>
              <p className="text-xs mt-1" style={{ color: colors.text }}>
                {request.remarks}
              </p>
            </div>
          )}

          {request.attachment_url && (
            <div className="pt-2 border-t" style={{ borderColor: `${colors.border}60` }}>
              <span className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: colors.muted }}>
                {t('oos_form_supporting_docs', 'Supporting Travel Documents')}
              </span>
              <a
                href={request.attachment_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Paperclip size={12} />
                <span>View Attached Document</span>
              </a>
            </div>
          )}
        </Card>

        {/* Duty Attendance Action Center matching Mobile */}
        <Card className="p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.muted }}>
            {t('oos_duty_attendance', 'Duty Attendance')}
          </h3>

          {!isApproved ? (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border flex items-start gap-2" style={{ borderColor: colors.border }}>
              <Info size={16} className="mt-0.5 flex-shrink-0" style={{ color: colors.muted }} />
              <p className="text-xs leading-relaxed" style={{ color: colors.muted }}>
                {t('oos_attendance_requires_approval', 'Duty clock-in will be enabled once your supervisor approves this travel request.')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Active Shift Indicator */}
              {isClockedIn && (
                <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-500/30 flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
                  <p className="text-xs font-bold text-green-700 dark:text-green-400 flex-1">
                    {t('oos_currently_on_shift', 'You are currently clocked in on active duty.')}
                  </p>
                </div>
              )}

              {/* Optional Notes Input */}
              <div className="mb-2">
                <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>
                  {t('attendance_notes_label', 'Notes / Remarks (Optional)')}
                </label>
                <Input
                  label=""
                  placeholder={t('attendance_notes_placeholder', 'Add optional notes for this duty log...')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              {isClockedIn ? (
                <Button
                  title={t('attendance_btn_clock_out', 'Clock Out from Duty Station')}
                  onClick={() => handleClockAction('out')}
                  loading={clockMutation.isPending}
                  className="w-full bg-red-600 dark:bg-red-700"
                />
              ) : (
                <div>
                  <Button
                    title={t('oos_btn_clock_in', 'Clock In for Out-of-Station Duty')}
                    onClick={() => handleClockAction('in')}
                    disabled={!isWithinGeofence || clockMutation.isPending}
                    loading={clockMutation.isPending}
                    className="w-full"
                  />
                  {!isWithinGeofence && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center mt-2">
                      {t('oos_clockin_locked_desc', 'Clock-in is locked until you are within 500m of the destination.')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};
export default OosDetailsScreen;

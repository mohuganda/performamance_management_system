import React, { useRef, useMemo, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleMap, Marker, Circle, useJsApiLoader } from '@react-google-maps/api';
import {
  ArrowLeft,
  Calendar,
  Smartphone,
  Globe,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  MapPin,
  Crosshair,
  ArrowDownLeft,
  ArrowUpRight,
  Activity,
  CheckCircle,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useThemeStore } from '../../stores/themeStore';
import { useAttendanceListQuery } from '../../hooks/useAttendance';
import { ClockResponse } from '../../api/attendance/types';
import { formatDate, formatTime } from '../../utils/date';
import { config } from '../../config';
import { GOOGLE_MAPS_SCRIPT_ID, getMapOptions } from '../../utils/googleMaps';

export const AttendanceDetailsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { colors } = useTheme();
  const { isDark } = useThemeStore();

  const mapRef = useRef<google.maps.Map | null>(null);

  // Fetch list or use cache if accessed directly by URL
  const { data: clocks } = useAttendanceListQuery();

  const log: ClockResponse | undefined = useMemo(() => {
    if (location.state?.log) return location.state.log;
    if (clocks && id) {
      return clocks.find(
        (c) => String(c.id) === id || (c as any).entry_id === id
      );
    }
    return undefined;
  }, [location.state, clocks, id]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: config.googleMapsApiKey,
  });

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  if (!log) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center text-center" style={{ backgroundColor: colors.background }}>
        <p className="text-base font-semibold mb-4" style={{ color: colors.muted }}>
          Attendance record not found.
        </p>
        <button
          type="button"
          onClick={() => navigate('/attendance')}
          className="px-5 py-2.5 rounded-none font-bold text-white text-sm transition-opacity hover:opacity-90 cursor-pointer"
          style={{ backgroundColor: colors.primary }}
        >
          Go Back
        </button>
      </div>
    );
  }

  const isClockIn = (log.action || log.clock_type) === 'in';
  const timestamp = log.clocked_at || log.created_at;
  const lat = log.latitude;
  const lng = log.longitude;
  const hasCoords = lat != null && lng != null && !isNaN(lat) && !isNaN(lng);
  const accuracyRadius = Math.max(log.accuracy_meters || 20, 10);

  // Formatted distance
  const distance = log.distance_from_destination_meters;
  const formattedDistance =
    distance != null
      ? distance >= 1000
        ? `${(distance / 1000).toFixed(2)} km`
        : `${distance.toFixed(1)} m`
      : '—';

  // Verification Status Breakdown
  const rawStatus = (log.verification_status || '').toLowerCase().trim();
  const isAtDutyStation = rawStatus === 'at_duty_station' || (!rawStatus && (log.verified || log.within_geofence));
  const isVerifiedOos = rawStatus === 'verified_oos';
  const isOutsideGeofence = rawStatus === 'outside_geofence';

  let statusTitle = t('attendance_pending_verification', 'Pending Verification');
  let statusDesc = 'Awaiting verification status from server';
  let statusIcon: React.ReactNode = <HelpCircle size={22} style={{ color: colors.muted }} strokeWidth={2} />;
  let statusBg: string = isDark ? 'rgba(63, 63, 70, 0.4)' : '#F3F4F6';
  let statusBorder: string = colors.border;
  let statusTextColor: string = colors.text;
  let statusSubColor: string = colors.muted;

  if (isAtDutyStation) {
    statusTitle = t('attendance_status_at_duty_station', 'At Duty Station');
    statusDesc = 'Officer clocked within assigned facility perimeter';
    statusIcon = <ShieldCheck size={22} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} strokeWidth={2} />;
    statusBg = isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5';
    statusBorder = isDark ? '#059669' : '#A7F3D0';
    statusTextColor = isDark ? '#34D399' : '#065F46';
    statusSubColor = isDark ? '#A7F3D0' : '#047857';
  } else if (isVerifiedOos) {
    statusTitle = t('attendance_status_verified_oos', 'Verified Out of Station');
    statusDesc = 'Verified duty attendance at approved travel destination';
    statusIcon = <CheckCircle size={22} className={isDark ? 'text-teal-400' : 'text-teal-600'} strokeWidth={2} />;
    statusBg = isDark ? 'rgba(13, 148, 136, 0.12)' : '#F0FDFA';
    statusBorder = isDark ? '#0D9488' : '#99F6E4';
    statusTextColor = isDark ? '#2DD4BF' : '#115E59';
    statusSubColor = isDark ? '#99F6E4' : '#0F766E';
  } else if (isOutsideGeofence) {
    statusTitle = t('attendance_status_outside_geofence', 'Outside Duty Station Geofence');
    statusDesc = `Clocked ${formattedDistance} from assigned station`;
    statusIcon = <AlertTriangle size={22} className={isDark ? 'text-amber-400' : 'text-amber-600'} strokeWidth={2} />;
    statusBg = isDark ? 'rgba(217, 119, 6, 0.12)' : '#FFFBEB';
    statusBorder = isDark ? '#D97706' : '#FDE68A';
    statusTextColor = isDark ? '#FBBF24' : '#92400E';
    statusSubColor = isDark ? '#FDE68A' : '#B45309';
  }

  const mapCenter = hasCoords ? { lat, lng } : { lat: 0.3476, lng: 32.5825 };

  const handleRecenter = () => {
    if (hasCoords && mapRef.current) {
      mapRef.current.panTo({ lat, lng });
      mapRef.current.setZoom(17);
    }
  };

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: colors.background }}>
      {/* Top Header */}
      <header
        className="sticky top-0 z-20 px-4 py-3.5 flex items-center justify-between border-b backdrop-blur-md"
        style={{
          backgroundColor: isDark ? 'rgba(24, 24, 27, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: colors.border,
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 font-bold text-sm hover:opacity-80 transition-opacity cursor-pointer"
          style={{ color: colors.text }}
        >
          <ArrowLeft size={18} />
          <span>{t('attendance_details_title', 'Attendance Log Details')}</span>
        </button>

        {/* Action Type Badge (rounded-none) */}
        <div
          className="px-2.5 py-1 rounded-none border flex items-center gap-1 font-bold text-xs uppercase tracking-wider"
          style={{
            backgroundColor: isClockIn
              ? isDark
                ? 'rgba(16, 185, 129, 0.2)'
                : '#ECFDF5'
              : isDark
              ? 'rgba(244, 63, 94, 0.2)'
              : '#FFF1F2',
            borderColor: isClockIn
              ? isDark
                ? '#059669'
                : '#A7F3D0'
              : isDark
              ? '#E11D48'
              : '#FECDD3',
            color: isClockIn
              ? isDark
                ? '#34D399'
                : '#059669'
              : isDark
              ? '#FB7185'
              : '#E11D48',
          }}
        >
          {isClockIn ? (
            <ArrowDownLeft size={12} strokeWidth={2.5} />
          ) : (
            <ArrowUpRight size={12} strokeWidth={2.5} />
          )}
          <span>
            {isClockIn
              ? t('attendance_btn_clock_in', 'Clock In')
              : t('attendance_btn_clock_out', 'Clock Out')}
          </span>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-4">
        {/* Primary Log Summary Card (rounded-none) */}
        <div
          className="p-5 rounded-none border shadow-sm"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <h1
                className="text-2xl font-black tracking-tight"
                style={{
                  color: isClockIn
                    ? isDark
                      ? '#34D399'
                      : '#059669'
                    : isDark
                    ? '#FB7185'
                    : '#E11D48',
                }}
              >
                {formatTime(timestamp, 'hh:mm:ss A')}
              </h1>
              <div className="flex items-center gap-1.5 mt-1">
                <Calendar size={13} style={{ color: colors.muted }} />
                <span className="text-xs font-semibold" style={{ color: colors.text }}>
                  {formatDate(timestamp, 'dddd, DD MMMM YYYY')}
                </span>
              </div>
            </div>

            {/* Source Pill (rounded-none) */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-none border border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 text-[11px] font-bold capitalize" style={{ color: colors.muted }}>
              {log.source === 'mobile' ? <Smartphone size={11} /> : <Globe size={11} />}
              <span>{log.source || 'mobile'}</span>
            </div>
          </div>

          {/* Verification HUD Banner (rounded-none) */}
          <div
            className="mt-4 p-3.5 rounded-none border flex items-center gap-2.5"
            style={{
              backgroundColor: statusBg,
              borderColor: statusBorder,
            }}
          >
            {statusIcon}

            <div className="flex-1 min-w-0">
              <p
                className="font-bold text-xs"
                style={{ color: statusTextColor }}
              >
                {statusTitle}
              </p>
              <p
                className="text-[11px] mt-0.5 truncate"
                style={{ color: statusSubColor }}
              >
                {statusDesc}
              </p>
            </div>
          </div>
        </div>

        {/* In-App Interactive Google Map (rounded-none) */}
        <div
          className="rounded-none border overflow-hidden shadow-sm"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
        >
          <div
            className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: colors.border }}
          >
            <div className="flex items-center gap-1.5">
              <MapPin size={15} style={{ color: colors.primary }} />
              <h2 className="font-bold text-xs uppercase tracking-wider" style={{ color: colors.text }}>
                {t('attendance_location_map', 'Punch Location Map')}
              </h2>
            </div>

            <button
              type="button"
              onClick={handleRecenter}
              className="flex items-center gap-1 px-2.5 py-1 rounded-none border border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 text-[10px] font-bold hover:opacity-80 cursor-pointer transition-opacity"
              style={{ color: colors.primary }}
            >
              <Crosshair size={12} />
              <span>{t('attendance_recenter_map', 'Recenter')}</span>
            </button>
          </div>

          <div className="h-64 w-full relative">
            {hasCoords && isLoaded ? (
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={mapCenter}
                zoom={17}
                onLoad={onMapLoad}
                options={getMapOptions(isDark)}
              >
                {/* Accuracy Radius Circle */}
                <Circle
                  center={{ lat, lng }}
                  radius={accuracyRadius}
                  options={{
                    fillColor: isClockIn ? '#10B981' : '#F43F5E',
                    fillOpacity: 0.18,
                    strokeColor: isClockIn ? '#059669' : '#E11D48',
                    strokeOpacity: 0.8,
                    strokeWeight: 1.5,
                  }}
                />

                {/* Clock-in Location Marker */}
                <Marker
                  position={{ lat, lng }}
                  title={isClockIn ? 'Clock In Location' : 'Clock Out Location'}
                />
              </GoogleMap>
            ) : loadError ? (
              <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                <AlertTriangle size={24} className="text-amber-500 mb-2" />
                <p className="text-xs text-zinc-500">Failed to load Google Maps.</p>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                <MapPin size={28} style={{ color: colors.muted }} className="mb-2" />
                <p className="text-xs" style={{ color: colors.muted }}>
                  Coordinates not available for this record.
                </p>
              </div>
            )}

            {/* In-Map Telemetry Chip (rounded-none) */}
            {hasCoords && (
              <div
                className="absolute bottom-3 left-3 right-3 px-3 py-2 rounded-none border flex items-center justify-between text-xs backdrop-blur-md"
                style={{
                  backgroundColor: isDark
                    ? 'rgba(24, 24, 27, 0.9)'
                    : 'rgba(255, 255, 255, 0.95)',
                  borderColor: colors.border,
                }}
              >
                <div className="flex items-center gap-1.5 font-mono font-bold" style={{ color: colors.text }}>
                  <MapPin size={12} style={{ color: colors.primary }} />
                  <span>
                    {lat.toFixed(5)}°, {lng.toFixed(5)}°
                  </span>
                </div>
                <span className="text-[10px] font-semibold" style={{ color: colors.muted }}>
                  Radius: ±{Math.round(accuracyRadius)}m
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Telemetry 2x2 Dashboard Grid */}
        <div>
          <h3
            className="font-bold text-xs uppercase tracking-wider mb-2.5 px-1"
            style={{ color: colors.muted }}
          >
            {t('attendance_telemetry', 'Audit Telemetry')}
          </h3>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Metric 1: Distance to Station */}
            <div
              className="p-3.5 rounded-none border"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <MapPin size={14} className={isOutsideGeofence ? 'text-amber-600' : 'text-emerald-600'} />
                <span className="text-[11px] font-medium" style={{ color: colors.muted }}>
                  {t('attendance_distance_from_station', 'Distance to Station')}
                </span>
              </div>
              <p
                className="text-base font-bold tracking-tight"
                style={{
                  color: isOutsideGeofence
                    ? isDark
                      ? '#FBBF24'
                      : '#D97706'
                    : isDark
                    ? '#34D399'
                    : '#059669',
                }}
              >
                {formattedDistance}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: colors.muted }}>
                {isAtDutyStation ? 'Target reached' : 'From boundary'}
              </p>
            </div>

            {/* Metric 2: Accuracy Radius */}
            <div
              className="p-3.5 rounded-none border"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Crosshair size={14} className="text-blue-500" />
                <span className="text-[11px] font-medium" style={{ color: colors.muted }}>
                  {t('attendance_accuracy_radius', 'GPS Accuracy Radius')}
                </span>
              </div>
              <p className="text-base font-bold tracking-tight" style={{ color: colors.text }}>
                {log.accuracy_meters != null
                  ? `±${log.accuracy_meters.toFixed(1)} m`
                  : '—'}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: colors.muted }}>
                Hardware GPS fix
              </p>
            </div>

            {/* Metric 3: Location Quality */}
            <div
              className="p-3.5 rounded-none border"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Activity size={14} className="text-purple-500" />
                <span className="text-[11px] font-medium" style={{ color: colors.muted }}>
                  {t('attendance_signal_quality', 'Signal Quality')}
                </span>
              </div>
              <p className="text-base font-bold tracking-tight" style={{ color: colors.text }}>
                {log.location_accuracy_percent != null
                  ? `${log.location_accuracy_percent.toFixed(1)}%`
                  : log.accuracy_meters && log.accuracy_meters < 30
                  ? 'High (90%)'
                  : 'Standard'}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: colors.muted }}>
                Confidence score
              </p>
            </div>

            {/* Metric 4: Clock Date (Replaced Entry ID) */}
            <div
              className="p-3.5 rounded-none border"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar size={14} style={{ color: colors.primary }} />
                <span className="text-[11px] font-medium" style={{ color: colors.muted }}>
                  {t('attendance_date', 'Clock Date')}
                </span>
              </div>
              <p className="text-base font-bold tracking-tight truncate" style={{ color: colors.text }}>
                {formatDate(timestamp, 'DD MMM YYYY')}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: colors.muted }}>
                {formatDate(timestamp, 'dddd')}
              </p>
            </div>
          </div>
        </div>

        {/* Additional Remarks / Notes */}
        {log.notes ? (
          <div
            className="p-4 rounded-none border"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <h4
              className="text-xs font-bold uppercase tracking-wider mb-1"
              style={{ color: colors.muted }}
            >
              {t('attendance_notes_label', 'Notes')}
            </h4>
            <p className="text-sm italic" style={{ color: colors.text }}>
              "{log.notes}"
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default AttendanceDetailsScreen;

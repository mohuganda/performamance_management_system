import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  HelpCircle,
  ChevronRight,
  MapPin,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { ClockResponse } from '../../api/attendance/types';
import { formatDate as defaultFormatDate, formatTime as defaultFormatTime } from '../../utils/date';

interface AttendanceHistoryProps {
  isLoading: boolean;
  sortedClocks: ClockResponse[];
  formatDate?: (timeStr?: string) => string;
  formatTime?: (timeStr?: string) => string;
  limit?: number;
  title?: string;
  onPressItem?: (item: ClockResponse) => void;
  onViewAll?: () => void;
}

export const AttendanceHistory: React.FC<AttendanceHistoryProps> = ({
  isLoading,
  sortedClocks,
  formatDate = (t) => defaultFormatDate(t, 'ddd, DD MMM YYYY'),
  formatTime = (t) => defaultFormatTime(t, 'hh:mm A'),
  limit,
  title,
  onPressItem,
  onViewAll,
}) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const displayedClocks = typeof limit === 'number' && limit > 0
    ? sortedClocks.slice(0, limit)
    : sortedClocks;

  const hasMore = typeof limit === 'number' && sortedClocks.length > limit;

  // Helper for status badge details
  const getStatusBadge = (row: ClockResponse) => {
    if (row.isOfflinePending) {
      return {
        label: t('attendance_status_pending_sync', 'Pending Sync'),
        icon: <RefreshCw size={10} className="animate-spin text-blue-500" />,
        bgColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
        borderColor: isDark ? '#1D4ED8' : '#BFDBFE',
        textColor: isDark ? '#60A5FA' : '#1D4ED8',
      };
    }

    const rawStatus = (row.verification_status || '').toLowerCase().trim();

    if (rawStatus === 'at_duty_station' || (!rawStatus && (row.verified || row.within_geofence))) {
      return {
        label: t('attendance_status_at_duty_station', 'At Duty Station'),
        icon: <ShieldCheck size={11} className="text-emerald-600" />,
        bgColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
        borderColor: isDark ? '#059669' : '#A7F3D0',
        textColor: isDark ? '#34D399' : '#065F46',
      };
    }

    if (rawStatus === 'verified_oos') {
      return {
        label: t('attendance_status_verified_oos', 'Verified OOS'),
        icon: <CheckCircle size={10} className="text-teal-600" />,
        bgColor: isDark ? 'rgba(13, 148, 136, 0.15)' : '#F0FDFA',
        borderColor: isDark ? '#0D9488' : '#99F6E4',
        textColor: isDark ? '#2DD4BF' : '#115E59',
      };
    }

    if (rawStatus === 'outside_geofence') {
      return {
        label: t('attendance_status_outside_geofence', 'Outside Geofence'),
        icon: <AlertTriangle size={10} className="text-amber-600" />,
        bgColor: isDark ? 'rgba(217, 119, 6, 0.15)' : '#FFFBEB',
        borderColor: isDark ? '#D97706' : '#FDE68A',
        textColor: isDark ? '#FBBF24' : '#92400E',
      };
    }

    return {
      label: t('attendance_pending_verification', 'Pending Verification'),
      icon: <HelpCircle size={10} className="text-gray-500" />,
      bgColor: isDark ? 'rgba(63, 63, 70, 0.3)' : '#F3F4F6',
      borderColor: isDark ? '#52525B' : '#E5E7EB',
      textColor: isDark ? '#A1A1AA' : '#4B5563',
    };
  };

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h3
          className="font-bold text-xs uppercase tracking-wider"
          style={{ color: colors.muted }}
        >
          {title || t('attendance_history_title', 'Attendance History')}
        </h3>
        {hasMore && onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-semibold hover:underline cursor-pointer transition-colors"
            style={{ color: colors.primary }}
          >
            {t('attendance_view_all', 'View Full History')} →
          </button>
        )}
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="py-8 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin" style={{ color: colors.primary }} />
        </div>
      ) : sortedClocks.length === 0 ? (
        /* Empty state */
        <div
          className="flex flex-col items-center justify-center py-8 px-4 rounded-none border border-dashed text-center"
          style={{
            backgroundColor: isDark ? 'rgba(39, 39, 42, 0.4)' : '#F9FAFB',
            borderColor: colors.border,
          }}
        >
          <Clock size={28} style={{ color: colors.muted, opacity: 0.7, marginBottom: 8 }} />
          <p className="text-sm font-medium" style={{ color: colors.muted }}>
            {t('attendance_no_recent_logs', 'No recent attendance logs recorded.')}
          </p>
        </div>
      ) : (
        /* Attendance List (No vertical line, rounded-none) */
        <div className="flex flex-col gap-2.5">
          {displayedClocks.map((row, index) => {
            const isRowIn = (row.action || row.clock_type) === 'in';
            const timestamp = row.clocked_at || row.created_at;
            const statusBadge = getStatusBadge(row);

            // Distance formatting
            const distance = row.distance_from_destination_meters;
            const formattedDistance =
              distance != null && distance > 0
                ? distance >= 1000
                  ? `${(distance / 1000).toFixed(1)}km away`
                  : `${Math.round(distance)}m away`
                : null;

            return (
              <div
                key={row.id || (row as any).entry_id || index}
                role="button"
                tabIndex={0}
                onClick={() => onPressItem?.(row)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onPressItem?.(row);
                  }
                }}
                className={`p-3.5 rounded-none border transition-all select-none ${onPressItem ? 'cursor-pointer hover:border-emerald-500/50 hover:shadow-sm' : ''
                  }`}
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                }}
              >
                {/* Top Row: Left IN/OUT + Time, Right: Status Badge */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-none flex items-center justify-center"
                    >
                      {isRowIn ? (
                        <ArrowDownLeft
                          size={13}
                          color={isDark ? '#34D399' : '#059669'}
                          strokeWidth={2.5}
                        />
                      ) : (
                        <ArrowUpRight
                          size={13}
                          color={isDark ? '#FB7185' : '#E11D48'}
                          strokeWidth={2.5}
                        />
                      )}
                    </div>
                    <span
                      className="font-bold text-sm tracking-tight"
                      style={{
                        color: isRowIn
                          ? isDark
                            ? '#34D399'
                            : '#059669'
                          : isDark
                            ? '#FB7185'
                            : '#E11D48',
                      }}
                    >
                      {isRowIn
                        ? t('attendance_btn_clock_in', 'Clock In')
                        : t('attendance_btn_clock_out', 'Clock Out')}
                    </span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: colors.text }}
                    >
                      · {formatTime(timestamp)}
                    </span>
                  </div>

                  {/* Status Badge positioned TOP-RIGHT */}
                  <div
                    className="flex items-center gap-1 px-2 py-1 rounded-none text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: statusBadge.bgColor,
                      color: statusBadge.textColor,
                    }}
                  >
                    {statusBadge.icon}
                    <span>{statusBadge.label}</span>
                  </div>
                </div>

                {/* Bottom Row: Date & Telemetry on left, Chevron on right */}
                <div className="flex items-center justify-between mt-1">
                  <div className="flex-1 mr-2 min-w-0">
                    <p className="text-xs truncate" style={{ color: colors.muted }}>
                      {formatDate(timestamp)}
                    </p>

                    {/* Distance & Accuracy row */}
                    {(formattedDistance || row.accuracy_meters != null) && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {formattedDistance && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-none bg-gray-100 dark:bg-zinc-800 text-[10px] font-medium"
                            style={{ color: colors.muted }}
                          >
                            <MapPin size={9} />
                            <span>{formattedDistance}</span>
                          </div>
                        )}

                        {row.accuracy_meters != null && (
                          <div
                            className="px-1.5 py-0.5 rounded-none bg-gray-100 dark:bg-zinc-800 text-[10px] font-medium"
                            style={{ color: colors.muted }}
                          >
                            <span>±{Math.round(row.accuracy_meters)}m</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes preview if any */}
                    {row.notes ? (
                      <p
                        className="text-xs italic mt-1.5 truncate"
                        style={{ color: colors.muted }}
                      >
                        "{row.notes}"
                      </p>
                    ) : null}
                  </div>

                  {onPressItem && (
                    <ChevronRight size={18} style={{ color: colors.muted, opacity: 0.6 }} />
                  )}
                </div>
              </div>
            );
          })}

          {/* View More / View All CTA */}
          {hasMore && onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="py-3 px-4 rounded-none border text-center font-bold text-xs hover:bg-gray-50 dark:hover:bg-zinc-800/60 cursor-pointer transition-colors mt-1"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.primary,
              }}
            >
              {t('attendance_view_all', 'View All')} ({sortedClocks.length}) →
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceHistory;

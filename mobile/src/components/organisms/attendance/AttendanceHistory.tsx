import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
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
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../app/hooks/useTheme';
import { ClockResponse } from '../../../api/attendance/types';
import { formatDate as defaultFormatDate, formatTime as defaultFormatTime } from '../../../utils/date';

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
        label: t('attendance_status_pending_sync'),
        icon: <RefreshCw size={10} color="#3B82F6" />,
        bgColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
        borderColor: isDark ? '#1D4ED8' : '#BFDBFE',
        textColor: isDark ? '#60A5FA' : '#1D4ED8',
      };
    }

    const rawStatus = (row.verification_status || '').toLowerCase().trim();

    if (rawStatus === 'at_duty_station' || (!rawStatus && (row.verified || row.within_geofence))) {
      return {
        label: t('attendance_status_at_duty_station'),
        icon: <ShieldCheck size={11} color="#059669" />,
        bgColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
        borderColor: isDark ? '#059669' : '#A7F3D0',
        textColor: isDark ? '#34D399' : '#065F46',
      };
    }

    if (rawStatus === 'verified_oos') {
      return {
        label: t('attendance_status_verified_oos'),
        icon: <CheckCircle size={10} color="#0D9488" />,
        bgColor: isDark ? 'rgba(13, 148, 136, 0.15)' : '#F0FDFA',
        borderColor: isDark ? '#0D9488' : '#99F6E4',
        textColor: isDark ? '#2DD4BF' : '#115E59',
      };
    }

    if (rawStatus === 'outside_geofence') {
      return {
        label: t('attendance_status_outside_geofence'),
        icon: <AlertTriangle size={10} color="#D97706" />,
        bgColor: isDark ? 'rgba(217, 119, 6, 0.15)' : '#FFFBEB',
        borderColor: isDark ? '#D97706' : '#FDE68A',
        textColor: isDark ? '#FBBF24' : '#92400E',
      };
    }

    return {
      label: t('attendance_pending_verification'),
      icon: <HelpCircle size={10} color="#6B7280" />,
      bgColor: isDark ? 'rgba(63, 63, 70, 0.3)' : '#F3F4F6',
      borderColor: isDark ? '#52525B' : '#E5E7EB',
      textColor: isDark ? '#A1A1AA' : '#4B5563',
    };
  };

  return (
    <View className="mb-6">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3 px-1">
        <Text
          className="font-bold text-xs uppercase tracking-wider"
          style={{ color: colors.muted }}
        >
          {title || t('attendance_history_title')}
        </Text>
        {hasMore && onViewAll && (
          <TouchableOpacity
            onPress={onViewAll}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: colors.primary }}
            >
              {t('attendance_view_all')} →
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Loading state */}
      {isLoading ? (
        <View className="py-8 items-center justify-center">
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : sortedClocks.length === 0 ? (
        /* Empty state */
        <View
          className="items-center justify-center py-8 px-4 rounded-none border border-dashed"
          style={{
            backgroundColor: isDark ? 'rgba(39, 39, 42, 0.4)' : '#F9FAFB',
            borderColor: colors.border,
          }}
        >
          <Clock size={28} color={colors.muted} style={{ opacity: 0.7, marginBottom: 8 }} />
          <Text className="text-sm font-medium" style={{ color: colors.muted }}>
            {t('attendance_no_recent_logs')}
          </Text>
        </View>
      ) : (
        /* Attendance List (No vertical line, rounded-none) */
        <View className="flex-col gap-y-2.5">
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
              <TouchableOpacity
                key={row.id || (row as any).entry_id || index}
                activeOpacity={onPressItem ? 0.7 : 1}
                onPress={() => onPressItem?.(row)}
                className="p-3.5 rounded-none border"
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                }}
              >
                {/* Top Row: Left IN/OUT + Time, Right: Status Badge */}
                <View className="flex-row items-center justify-between mb-1.5">
                  <View className="flex-row items-center gap-2">
                    <View
                      className="w-6 h-6 rounded-none items-center justify-center"

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
                    </View>
                    <Text
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
                        ? t('attendance_btn_clock_in')
                        : t('attendance_btn_clock_out')}
                    </Text>
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: colors.text }}
                    >
                      · {formatTime(timestamp)}
                    </Text>
                  </View>

                  {/* Status Badge positioned TOP-RIGHT */}
                  <View
                    className="flex-row items-center gap-1 px-2 py-1 rounded-none"
                    style={{
                      backgroundColor: statusBadge.bgColor,
                    }}
                  >
                    {statusBadge.icon}
                    <Text
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: statusBadge.textColor }}
                    >
                      {statusBadge.label}
                    </Text>
                  </View>
                </View>

                {/* Bottom Row: Date & Telemetry on left, Chevron on right */}
                <View className="flex-row items-center justify-between mt-1">
                  <View className="flex-1 mr-2">
                    <Text className="text-xs" style={{ color: colors.muted }}>
                      {formatDate(timestamp)}
                    </Text>

                    {/* Distance & Accuracy row */}
                    {(formattedDistance || row.accuracy_meters != null) && (
                      <View className="flex-row flex-wrap items-center gap-1.5 mt-1.5">
                        {formattedDistance && (
                          <View className="flex-row items-center gap-0.5 px-1.5 py-0.5 rounded-none bg-gray-100 dark:bg-zinc-800">
                            <MapPin size={9} color={colors.muted} />
                            <Text
                              className="text-[10px] font-medium"
                              style={{ color: colors.muted }}
                            >
                              {formattedDistance}
                            </Text>
                          </View>
                        )}

                        {row.accuracy_meters != null && (
                          <View className="px-1.5 py-0.5 rounded-none bg-gray-100 dark:bg-zinc-800">
                            <Text
                              className="text-[10px] font-medium"
                              style={{ color: colors.muted }}
                            >
                              ±{Math.round(row.accuracy_meters)}m
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Notes preview if any */}
                    {row.notes ? (
                      <Text
                        className="text-xs italic mt-1.5"
                        numberOfLines={1}
                        style={{ color: colors.muted }}
                      >
                        "{row.notes}"
                      </Text>
                    ) : null}
                  </View>

                  {onPressItem && (
                    <ChevronRight size={18} color={colors.muted} style={{ opacity: 0.6 }} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* View More / View All CTA */}
          {hasMore && onViewAll && (
            <TouchableOpacity
              onPress={onViewAll}
              activeOpacity={0.7}
              className="py-3 px-4 rounded-none border items-center justify-center mt-1"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
            >
              <Text
                className="text-xs font-bold"
                style={{ color: colors.primary }}
              >
                {t('attendance_view_all')} ({sortedClocks.length}) →
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

export default AttendanceHistory;

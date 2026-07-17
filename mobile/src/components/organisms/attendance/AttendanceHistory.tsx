import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { CheckCircle, HelpCircle, RefreshCw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../app/hooks/useTheme';
import { ClockResponse } from '../../../api/attendance/types';

interface AttendanceHistoryProps {
  isLoading: boolean;
  sortedClocks: ClockResponse[];
  formatDate: (timeStr?: string) => string;
  formatTime: (timeStr?: string) => string;
}

export const AttendanceHistory: React.FC<AttendanceHistoryProps> = ({
  isLoading,
  sortedClocks,
  formatDate,
  formatTime,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View className="mb-10">
      <Text className="font-bold text-base mb-4 uppercase tracking-wider text-gray-500">
        {t('attendance_history_title')}
      </Text>

      {isLoading ? (
        <ActivityIndicator size="small" color={colors.primary} className="my-6" />
      ) : sortedClocks.length === 0 ? (
        <View className="items-center py-8">
          <Text className="text-sm text-gray-400 font-medium">No recent logs recorded.</Text>
        </View>
      ) : (
        <View className="flex-col pl-2">
          {sortedClocks.map((row, index) => {
            const isRowIn = row.action === 'in';
            const timestamp = row.clocked_at || row.created_at;
            return (
              <View key={row.id || index} className="flex-row items-start relative pb-6">
                {/* Vertical connector line */}
                {index < sortedClocks.length - 1 && (
                  <View
                    className="absolute w-[2px] bottom-0 top-8 left-4"
                    style={{ backgroundColor: colors.border }}
                  />
                )}

                {/* Status indicator bubble */}
                <View
                  className="w-8 h-8 rounded-full items-center justify-center border z-10 mr-4 shadow-sm"
                  style={{
                    backgroundColor: isRowIn ? 'rgba(21, 128, 61, 0.1)' : 'rgba(217, 0, 0, 0.1)',
                    borderColor: isRowIn ? colors.success : colors.error,
                  }}
                >
                  <Text
                    className="font-bold text-xs uppercase"
                    style={{ color: isRowIn ? colors.success : colors.error }}
                  >
                    {isRowIn ? 'IN' : 'OUT'}
                  </Text>
                </View>

                {/* Log details card */}
                <View
                  className="flex-1 p-4 rounded-none border"
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  }}
                >
                  <View className="flex-row items-center justify-between mb-1.5">
                    <Text className="font-bold text-sm" style={{ color: colors.text }}>
                      {formatDate(timestamp)}
                    </Text>
                    <Text className="text-xs text-gray-400 font-medium">
                      {formatTime(timestamp)}
                    </Text>
                  </View>

                  <Text className="text-xs text-gray-400" style={{ lineHeight: 16 }}>
                    GPS: {row.latitude != null && row.longitude != null
                      ? `${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)}`
                      : '—'}
                  </Text>

                  {row.notes ? (
                    <View className="mt-2 pt-2 border-t" style={{ borderColor: `${colors.border}50` }}>
                      <Text className="text-xs italic text-gray-500 dark:text-gray-400">
                        "{row.notes}"
                      </Text>
                    </View>
                  ) : null}

                  {/* Verification details badge */}
                  <View className="flex-row justify-end mt-2">
                    <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800">
                      {(row as any).isOfflinePending ? (
                        <>
                          <RefreshCw size={10} color="#3B82F6" />
                          <Text className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                            {t('attendance_status_pending_sync')}
                          </Text>
                        </>
                      ) : row.verified || row.within_geofence ? (
                        <>
                          <CheckCircle size={10} color={colors.success} />
                          <Text className="text-[10px] font-bold text-green-700 dark:text-green-400">Verified</Text>
                        </>
                      ) : (
                        <>
                          <HelpCircle size={10} color={colors.warning} />
                          <Text className="text-[10px] font-bold" style={{ color: colors.warning }}>Pending Verification</Text>
                        </>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};
export default AttendanceHistory;

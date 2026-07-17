import React from 'react';
import { View, Text } from 'react-native';
import { Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../app/hooks/useTheme';
import { ActiveShiftTimer } from '../../molecules/ActiveShiftTimer';
import { ClockResponse } from '../../../api/attendance/types';

interface AttendanceStatusCardProps {
  isClockedIn: boolean;
  latestClock: ClockResponse | null;
  formatTime: (timeStr?: string) => string;
}

export const AttendanceStatusCard: React.FC<AttendanceStatusCardProps> = ({
  isClockedIn,
  latestClock,
  formatTime,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View
      className="p-5 rounded-none border mb-4 shadow-sm"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-gray-400 font-semibold uppercase text-xs tracking-wider">
          {t('attendance_status_label')}
        </Text>
        <View className="flex-row items-center gap-1">
          <Clock size={14} color="#9CA3AF" />
          <Text className="text-gray-400 font-medium text-xs">
            {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>
        </View>
      </View>

      {isClockedIn && latestClock ? (
        <ActiveShiftTimer clockedInAt={latestClock.clocked_at || latestClock.created_at || ''} />
      ) : (
        <View className="flex-row items-center gap-3 py-2">
          <View className="w-10 h-10 rounded-full items-center justify-center bg-gray-100 dark:bg-gray-800">
            <Clock size={20} color="#9CA3AF" />
          </View>
          <View>
            <Text className="text-2xl font-bold font-mono tracking-wide" style={{ color: colors.text }}>
              {t('attendance_status_clocked_out')}
            </Text>
            <Text className="text-xs text-gray-400 font-semibold mt-0.5">
              {latestClock
                ? `Last Shift End: ${formatTime(latestClock.clocked_at || latestClock.created_at)}`
                : 'No logs recorded for today'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};
export default AttendanceStatusCard;

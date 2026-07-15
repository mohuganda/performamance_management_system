import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Play } from 'lucide-react-native';
import { useTheme } from '../../app/hooks/useTheme';

interface ActiveShiftTimerProps {
  clockedInAt: string;
}

export function ActiveShiftTimer({ clockedInAt }: ActiveShiftTimerProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [timeString, setTimeString] = useState('00:00:00');

  useEffect(() => {
    const startTime = new Date(clockedInAt).getTime();
    if (isNaN(startTime)) {
      setTimeString('00:00:00');
      return;
    }

    const updateTimer = () => {
      const diffMs = Date.now() - startTime;
      if (diffMs < 0) {
        setTimeString('00:00:00');
        return;
      }

      const totalSecs = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const minutes = Math.floor((totalSecs % 3600) / 60);
      const seconds = totalSecs % 60;

      const pad = (num: number) => String(num).padStart(2, '0');
      setTimeString(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    };

    updateTimer(); // run once immediately
    const intervalId = setInterval(updateTimer, 1000);

    return () => clearInterval(intervalId);
  }, [clockedInAt]);

  return (
    <View 
      className="w-full flex-row items-center justify-between p-4 rounded-2xl border"
      style={{ 
        backgroundColor: isDark ? 'rgba(21, 128, 61, 0.15)' : 'rgba(21, 128, 61, 0.08)',
        borderColor: isDark ? 'rgba(21, 128, 61, 0.3)' : 'rgba(21, 128, 61, 0.15)'
      }}
    >
      <View className="flex-row items-center gap-3">
        <View className="w-10 h-10 rounded-full items-center justify-center bg-green-100 dark:bg-green-900/30">
          <Play size={18} color={colors.success} fill={colors.success} />
        </View>
        <View>
          <Text 
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: colors.success }}
          >
            {t('attendance_active_timer_label')}
          </Text>
          <Text 
            className="text-2xl font-mono font-bold tracking-widest mt-0.5"
            style={{ color: colors.text }}
          >
            {timeString}
          </Text>
        </View>
      </View>
      <View className="items-end">
        <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10">
          <View className="w-2 h-2 rounded-full bg-green-500" />
          <Text className="text-xs font-bold text-green-600 dark:text-green-400">ON SHIFT</Text>
        </View>
      </View>
    </View>
  );
}
export default ActiveShiftTimer;

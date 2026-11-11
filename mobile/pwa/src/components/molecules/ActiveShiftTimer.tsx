import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Play } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface ActiveShiftTimerProps {
  clockedInAt: string;
}

export const ActiveShiftTimer: React.FC<ActiveShiftTimerProps> = ({ clockedInAt }) => {
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

    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);

    return () => clearInterval(intervalId);
  }, [clockedInAt]);

  return (
    <div
      className="w-full flex items-center justify-between p-4 rounded-none border transition-colors"
      style={{
        backgroundColor: isDark ? 'rgba(21, 128, 61, 0.15)' : 'rgba(21, 128, 61, 0.08)',
        borderColor: isDark ? 'rgba(21, 128, 61, 0.3)' : 'rgba(21, 128, 61, 0.15)',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-100 dark:bg-green-900/30 flex-shrink-0">
          <Play size={18} color={colors.success} fill={colors.success} />
        </div>
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wider leading-none"
            style={{ color: colors.success }}
          >
            {t('attendance_active_timer_label', 'ACTIVE SHIFT TIMER')}
          </p>
          <p
            className="text-2xl font-mono font-bold tracking-widest mt-1 leading-none"
            style={{ color: colors.text }}
          >
            {timeString}
          </p>
        </div>
      </div>

      <div className="flex items-center">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wide">
            ON SHIFT
          </span>
        </div>
      </div>
    </div>
  );
};


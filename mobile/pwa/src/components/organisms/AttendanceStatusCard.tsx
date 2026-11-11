import React from 'react';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { ActiveShiftTimer } from '../molecules/ActiveShiftTimer';
import { ClockResponse } from '../../api/attendance/types';
import { formatDate } from '../../utils/date';

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
    <div
      className="p-5 rounded-none border mb-4 shadow-sm transition-colors"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
      }}
    >
      <div className="flex justify-between items-center mb-3">
        <span
          className="font-semibold uppercase text-xs tracking-wider"
          style={{ color: colors.muted }}
        >
          {t('attendance_status_label', 'ATTENDANCE STATUS')}
        </span>
        <div className="flex items-center gap-1.5" style={{ color: colors.muted }}>
          <Clock size={14} />
          <span className="font-medium text-xs">
            {formatDate(new Date(), 'ddd, MMM D')}
          </span>
        </div>
      </div>

      {isClockedIn && latestClock ? (
        <ActiveShiftTimer clockedInAt={latestClock.clocked_at || (latestClock as any).created_at || ''} />
      ) : (
        <div className="flex items-center gap-3 py-2">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 flex-shrink-0">
            <Clock size={20} className="text-gray-400" />
          </div>
          <div>
            <h3
              className="text-2xl font-bold font-mono tracking-wide leading-none"
              style={{ color: colors.text }}
            >
              {t('attendance_status_clocked_out', 'CLOCKED OUT')}
            </h3>
            <p
              className="text-xs font-semibold mt-1"
              style={{ color: colors.muted }}
            >
              {latestClock
                ? `Last Shift End: ${formatTime(latestClock.clocked_at || (latestClock as any).created_at)}`
                : 'No logs recorded for today'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
export default AttendanceStatusCard;


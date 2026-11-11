import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { ClockResponse } from '../../api/attendance/types';

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
    <div className="mb-10">
      <h3
        className="font-bold text-base mb-4 uppercase tracking-wider"
        style={{ color: colors.muted }}
      >
        {t('attendance_history_title', 'ATTENDANCE HISTORY')}
      </h3>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin" size={24} style={{ color: colors.primary }} />
        </div>
      ) : sortedClocks.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm font-medium" style={{ color: colors.muted }}>
            No recent logs recorded.
          </p>
        </div>
      ) : (
        <div className="flex flex-col pl-2">
          {sortedClocks.map((row, index) => {
            const isRowIn = row.action === 'in';
            const timestamp = row.clocked_at || (row as any).created_at;
            const isLast = index === sortedClocks.length - 1;

            return (
              <div key={row.id || index} className="flex items-start relative pb-6">
                {/* Vertical connector line */}
                {!isLast && (
                  <div
                    className="absolute w-[2px] bottom-0 top-8 left-4"
                    style={{ backgroundColor: colors.border }}
                  />
                )}

                {/* Status indicator bubble */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center border z-10 mr-4 shadow-sm flex-shrink-0"
                  style={{
                    backgroundColor: isRowIn ? 'rgba(21, 128, 61, 0.1)' : 'rgba(217, 0, 0, 0.1)',
                    borderColor: isRowIn ? colors.success : colors.error,
                  }}
                >
                  <span
                    className="font-bold text-xs uppercase"
                    style={{ color: isRowIn ? colors.success : colors.error }}
                  >
                    {isRowIn ? 'IN' : 'OUT'}
                  </span>
                </div>

                {/* Log details card */}
                <div
                  className="flex-1 p-4 rounded-none border"
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm" style={{ color: colors.text }}>
                      {formatDate(timestamp)}
                    </span>
                    <span className="text-xs font-medium" style={{ color: colors.muted }}>
                      {formatTime(timestamp)}
                    </span>
                  </div>

                  <p className="text-xs" style={{ color: colors.muted, lineHeight: '16px' }}>
                    GPS: {row.latitude != null && row.longitude != null
                      ? `${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)}`
                      : '—'}
                  </p>

                  {row.notes ? (
                    <div
                      className="mt-2 pt-2 border-t"
                      style={{ borderColor: `${colors.border}80` }}
                    >
                      <p className="text-xs italic" style={{ color: colors.muted }}>
                        "{row.notes}"
                      </p>
                    </div>
                  ) : null}

                  {/* Verification details badge */}
                  <div className="flex justify-end mt-2">
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-[10px]">
                      {row.verified !== false ? (
                        <>
                          <CheckCircle size={12} className="text-emerald-500" />
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">Verified</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={12} className="text-amber-500" />
                          <span className="font-semibold text-amber-600 dark:text-amber-400">Unverified</span>
                        </>
                      )}
                      {row.accuracy_meters && (
                        <span className="ml-1 text-gray-400">±{Math.round(row.accuracy_meters)}m</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


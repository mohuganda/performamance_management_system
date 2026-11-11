import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Card } from '../atoms/Card';
import { LeaveBalance, LeaveType } from '../../api/leave/types';

interface ProgressCircleProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  backgroundColor: string;
}

export const ProgressCircle: React.FC<ProgressCircleProps> = ({
  percentage,
  size = 72,
  strokeWidth = 6,
  color,
  backgroundColor,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(Math.max(percentage, 0), 100) / 100) * circumference;

  return (
    <svg width={size} height={size} className="overflow-visible">
      <circle
        stroke={backgroundColor}
        fill="transparent"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
      />
      <circle
        stroke={color}
        fill="transparent"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  );
};

interface LeaveBalancesProps {
  balances: LeaveBalance[];
  leaveTypes: LeaveType[];
  isLoading?: boolean;
}

export const LeaveBalances: React.FC<LeaveBalancesProps> = ({
  balances,
  leaveTypes,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const typeMap = React.useMemo(() => {
    const map = new Map<number, string>();
    leaveTypes.forEach((tp) => {
      map.set(tp.id, tp.name);
    });
    return map;
  }, [leaveTypes]);

  if (isLoading && balances.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin" size={24} style={{ color: colors.primary }} />
      </div>
    );
  }

  if (balances.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm" style={{ color: colors.muted }}>
          {t('leave_balances_empty', 'No leave balances recorded.')}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {balances.map((row) => {
        const typeName = typeMap.get(row.leave_type_id) || 'Leave';
        const entitled = row.entitled_days ?? 0;
        const carriedOver = row.carried_over_days ?? 0;
        const used = row.used_days ?? 0;
        const total = entitled + carriedOver;
        const remaining = Math.max(total - used, 0);
        const percentageRemaining = total > 0 ? (remaining / total) * 100 : 0;

        let ringColor: string = colors.success;
        if (percentageRemaining < 25) {
          ringColor = colors.error;
        } else if (percentageRemaining < 50) {
          ringColor = colors.warning;
        }

        const circleSize = 72;

        return (
          <Card key={row.id || row.leave_type_id} className="flex items-center justify-between p-5 w-full">
            <div className="flex-1 pr-4 space-y-2 justify-center">
              <h4 className="text-base font-bold leading-tight" style={{ color: colors.text }}>
                {typeName}
              </h4>

              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium" style={{ color: colors.muted }}>
                    Entitled Days
                  </span>
                  <span className="font-semibold" style={{ color: colors.text }}>
                    {entitled}
                  </span>
                </div>

                {carriedOver > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium" style={{ color: colors.muted }}>
                      Carried Over
                    </span>
                    <span className="font-semibold" style={{ color: colors.text }}>
                      {carriedOver}
                    </span>
                  </div>
                )}

                <div
                  className="flex items-center justify-between pt-1 border-t"
                  style={{ borderColor: `${colors.border}60` }}
                >
                  <span className="font-medium" style={{ color: colors.muted }}>
                    Used Days
                  </span>
                  <span className="font-semibold" style={{ color: colors.text }}>
                    {used}
                  </span>
                </div>
              </div>
            </div>

            {/* Circular Progress Display */}
            <div
              className="relative flex items-center justify-center flex-shrink-0"
              style={{ width: circleSize, height: circleSize }}
            >
              <ProgressCircle
                percentage={percentageRemaining}
                size={circleSize}
                strokeWidth={6}
                color={ringColor}
                backgroundColor={isDark ? '#27272A' : '#E4E4E7'}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-base font-black leading-none" style={{ color: colors.text }}>
                  {remaining}
                </span>
                <span
                  className="text-[8px] uppercase font-bold tracking-wider leading-none mt-0.5"
                  style={{ color: colors.muted }}
                >
                  left
                </span>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
export default LeaveBalances;

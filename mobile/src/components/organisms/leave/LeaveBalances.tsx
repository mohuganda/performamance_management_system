import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../app/hooks/useTheme';
import { Card } from '../../atoms/Card';
import { useLeaveBalancesSync, useLeaveTypesSync } from '../../../app/hooks/useLeave';
import withObservables from '@nozbe/with-observables';
import { database } from '../../../db';
import LeaveBalanceModel from '../../../db/models/LeaveBalanceModel';
import LeaveTypeModel from '../../../db/models/LeaveTypeModel';

// SVG Progress Circle Component
interface ProgressCircleProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  backgroundColor: string;
}

const ProgressCircle: React.FC<ProgressCircleProps> = ({
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
    <Svg width={size} height={size}>
      <Circle
        stroke={backgroundColor}
        fill="transparent"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
      />
      <Circle
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
      />
    </Svg>
  );
};

interface LeaveBalancesProps {
  balances: LeaveBalanceModel[];
  leaveTypes: LeaveTypeModel[];
}

const BaseLeaveBalances: React.FC<LeaveBalancesProps> = ({ balances, leaveTypes }) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  // Trigger network sync in background
  const { isLoading: isBalancesLoading } = useLeaveBalancesSync();
  const { isLoading: isTypesLoading } = useLeaveTypesSync();

  const typeMap = React.useMemo(() => {
    const map = new Map<number, string>();
    if (leaveTypes) {
      leaveTypes.forEach((t) => {
        if (t.remoteId) {
          map.set(t.remoteId, t.name);
        }
      });
    }
    return map;
  }, [leaveTypes]);

  // We consider it empty only if DB has no balances and network hasn't returned yet
  const isEmpty = balances.length === 0;
  const isInitialLoading = isEmpty && (isBalancesLoading || isTypesLoading);

  if (isInitialLoading) {
    return <ActivityIndicator size="small" color={colors.primary} className="py-8" />;
  }

  if (isEmpty) {
    return (
      <Card className="p-6 items-center">
        <Text className="text-sm text-center" style={{ color: colors.muted }}>
          {t('leave_balances_empty')}
        </Text>
      </Card>
    );
  }

  return (
    <View className="space-y-4 rounded-none">
      {balances.map((row) => {
        const typeName = typeMap.get(row.leaveTypeId) ?? 'Leave';
        const entitled = row.entitledDays;
        const carriedOver = row.carriedOverDays;
        const used = row.usedDays;
        const total = entitled + carriedOver;
        const remaining = Math.max(total - used, 0);
        const percentageRemaining = total > 0 ? (remaining / total) * 100 : 0;

        let ringColor = colors.success;
        if (percentageRemaining < 25) {
          ringColor = colors.error;
        } else if (percentageRemaining < 50) {
          ringColor = colors.warning;
        }

        const circleSize = 72;

        return (
          <Card key={row.id} className="flex-row items-center justify-between p-5 w-full">
            <View className="flex-1 pr-4 space-y-2 justify-center">
              <Text className="text-base font-bold" style={{ color: colors.text }}>
                {typeName}
              </Text>

              <View className="space-y-1">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-medium" style={{ color: colors.muted }}>
                    Entitled Days
                  </Text>
                  <Text className="text-xs font-semibold" style={{ color: colors.text }}>
                    {entitled}
                  </Text>
                </View>
                {carriedOver > 0 && (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-medium" style={{ color: colors.muted }}>
                      Carried Over
                    </Text>
                    <Text className="text-xs font-semibold" style={{ color: colors.text }}>
                      {carriedOver}
                    </Text>
                  </View>
                )}
                <View className="flex-row items-center justify-between border-t border-gray-100 dark:border-zinc-900 pt-1">
                  <Text className="text-xs font-medium" style={{ color: colors.muted }}>
                    Used Days
                  </Text>
                  <Text className="text-xs font-semibold" style={{ color: colors.text }}>
                    {used}
                  </Text>
                </View>
              </View>
            </View>

            {/* Circular Progress Display */}
            <View className="items-center justify-center" style={{ width: circleSize, height: circleSize }}>
              <ProgressCircle
                percentage={percentageRemaining}
                size={circleSize}
                strokeWidth={6}
                color={ringColor}
                backgroundColor={isDark ? '#27272A' : '#E4E4E7'}
              />
              <View style={{ position: 'absolute' }} className="items-center justify-center">
                <Text className="text-base font-black" style={{ color: colors.text }}>
                  {remaining}
                </Text>
                <Text className="text-[8px] uppercase font-bold tracking-wider" style={{ color: colors.muted }}>
                  left
                </Text>
              </View>
            </View>
          </Card>
        );
      })}
    </View>
  );
};

export const LeaveBalances = withObservables([], () => ({
  balances: database.collections.get<LeaveBalanceModel>('leave_balances').query().observe(),
  leaveTypes: database.collections.get<LeaveTypeModel>('leave_types').query().observe(),
}))(BaseLeaveBalances);


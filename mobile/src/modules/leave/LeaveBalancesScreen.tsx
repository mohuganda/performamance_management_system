import React from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../app/hooks/useTheme';
import { MainTemplate } from '../../components/templates';
import { Card } from '../../components/atoms/Card';
import { useLeaveBalancesQuery, useLeaveTypesQuery } from '../../app/hooks/useLeave';

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
  size = 80,
  strokeWidth = 8,
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

export function LeaveBalancesScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const { data: balances, isLoading: isBalancesLoading, refetch, isFetching } = useLeaveBalancesQuery();
  const { data: leaveTypes, isLoading: isTypesLoading } = useLeaveTypesQuery();

  const handleRefresh = () => {
    refetch();
  };

  const isLoading = isBalancesLoading || isTypesLoading;

  const typeMap = React.useMemo(() => {
    const map = new Map<number, string>();
    if (leaveTypes) {
      leaveTypes.forEach((t) => map.set(t.id, t.name));
    }
    return map;
  }, [leaveTypes]);

  return (
    <MainTemplate title={t('leave_balances_title')} showBack={true}>
      {isLoading && !isFetching ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          <View className="p-6 space-y-6">
            <Text className="text-sm" style={{ color: colors.muted }}>
              Your accrued leave limits, usage details, and current balances for the calendar year.
            </Text>

            {!balances || balances.length === 0 ? (
              <Card className="p-8 items-center justify-center">
                <Text className="text-base text-center" style={{ color: colors.muted }}>
                  {t('leave_balances_empty')}
                </Text>
              </Card>
            ) : (
              <View className="space-y-4">
                {balances.map((row) => {
                  const typeName = typeMap.get(row.leave_type_id) ?? 'Leave Request';
                  const entitled = row.entitled_days;
                  const carriedOver = row.carried_over_days;
                  const used = row.used_days;
                  const total = entitled + carriedOver;
                  const remaining = Math.max(total - used, 0);

                  // Calculate percentage remaining for visual rings
                  const percentageRemaining = total > 0 ? (remaining / total) * 100 : 0;

                  // Define dynamic ring color
                  let ringColor = colors.success; // Default green
                  if (percentageRemaining < 25) {
                    ringColor = colors.error; // Red if running low
                  } else if (percentageRemaining < 50) {
                    ringColor = colors.warning; // Orange if moderate
                  }

                  const circleSize = 90;

                  return (
                    <Card key={row.id ?? row.leave_type_id} className="flex-row items-center justify-between p-5">
                      <View className="flex-1 pr-4 space-y-2">
                        <Text className="text-lg font-bold" style={{ color: colors.text }}>
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
                          <View className="flex-row items-center justify-between border-t border-gray-100 dark:border-zinc-800 pt-1">
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
                          strokeWidth={8}
                          color={ringColor}
                          backgroundColor={isDark ? '#27272A' : '#E4E4E7'}
                        />
                        <View style={{ position: 'absolute' }} className="items-center justify-center">
                          <Text className="text-xl font-black" style={{ color: colors.text }}>
                            {remaining}
                          </Text>
                          <Text className="text-[9px] uppercase font-bold tracking-wider" style={{ color: colors.muted }}>
                            days left
                          </Text>
                        </View>
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </MainTemplate>
  );
}

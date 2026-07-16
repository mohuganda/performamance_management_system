import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { useTheme } from '../../app/hooks/useTheme';

export interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  onPress: () => void;
}

export function StatCard({ title, value, subtitle, icon, color, onPress }: StatCardProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      className="mb-3 rounded-none border p-4 shadow-sm"
      style={{
        width: '48%',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderTopWidth: 4,
        borderTopColor: color,
      }}
    >
      <View className="flex-row items-center mb-3">
        {icon}
        <Text
          className="ml-2 text-xs font-bold uppercase tracking-wider flex-1"
          style={{ color: colors.muted }}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      <View className="items-end">
        <Text className="text-3xl font-black" style={{ color: colors.text }}>
          {value}
        </Text>
        {subtitle && (
          <Text className="text-[10px] font-bold mt-1 uppercase tracking-wider" style={{ color: colors.muted }}>
            {subtitle}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

import React, { ReactNode } from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { useTheme } from '../../app/hooks/useTheme';

interface ActionCardProps {
  title: string;
  subtitle: string;
  icon: ReactNode;
  iconBgClass?: string;
  onPress: () => void;
}

export function ActionCard({ title, subtitle, icon, iconBgClass, onPress }: ActionCardProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      className="w-[48%] p-4 rounded-none items-center border border-border mb-3"
      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      onPress={onPress}
    >
      <View className={`w-10 h-10 rounded-full items-center justify-center mb-2 ${iconBgClass || 'bg-gray-100 dark:bg-gray-800'}`}>
        {icon}
      </View>
      <Text className="text-sm font-bold text-center" style={{ color: colors.text }}>
        {title}
      </Text>
      <Text className="text-[10px] mt-0.5 text-center" style={{ color: colors.muted }}>
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../app/hooks/useTheme';
import { Inbox } from 'lucide-react-native';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View className="items-center justify-center py-12 px-6">
      <View
        className="w-20 h-20 rounded-full items-center justify-center mb-6"
        style={{ backgroundColor: `${colors.primary}15` }}
      >
        {icon || <Inbox size={36} color={colors.primary} opacity={0.8} />}
      </View>
      <Text
        className="text-lg font-bold text-center mb-2"
        style={{ color: colors.text }}
      >
        {title}
      </Text>
      <Text
        className="text-sm text-center leading-relaxed"
        style={{ color: colors.muted }}
      >
        {description}
      </Text>
    </View>
  );
}

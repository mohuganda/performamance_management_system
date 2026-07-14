import React from 'react';
import { View, Text } from 'react-native';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'gray';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'gray',
  className = '',
}) => {
  let bgStyle = 'bg-gray-100 dark:bg-zinc-800';
  let textStyle = 'text-gray-700 dark:text-zinc-300';

  if (variant === 'success') {
    bgStyle = 'bg-emerald-50 dark:bg-emerald-950/30';
    textStyle = 'text-emerald-700 dark:text-emerald-400';
  } else if (variant === 'warning') {
    bgStyle = 'bg-amber-50 dark:bg-amber-950/30';
    textStyle = 'text-amber-700 dark:text-amber-400';
  } else if (variant === 'error') {
    bgStyle = 'bg-red-50 dark:bg-red-950/30';
    textStyle = 'text-red-700 dark:text-red-400';
  } else if (variant === 'info') {
    bgStyle = 'bg-blue-50 dark:bg-blue-950/30';
    textStyle = 'text-blue-700 dark:text-blue-400';
  }

  return (
    <View className={`px-2.5 py-1 rounded-full flex-row items-center self-start ${bgStyle} ${className}`}>
      <Text className={`text-xs font-semibold uppercase tracking-wider ${textStyle}`}>{label}</Text>
    </View>
  );
};

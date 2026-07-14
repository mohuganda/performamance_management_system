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
  let bgStyle = 'bg-gray-100';
  let textStyle = 'text-gray-700';

  if (variant === 'success') {
    bgStyle = 'bg-emerald-50';
    textStyle = 'text-emerald-700';
  } else if (variant === 'warning') {
    bgStyle = 'bg-amber-50';
    textStyle = 'text-amber-700';
  } else if (variant === 'error') {
    bgStyle = 'bg-red-50';
    textStyle = 'text-red-700';
  } else if (variant === 'info') {
    bgStyle = 'bg-blue-50';
    textStyle = 'text-blue-700';
  }

  return (
    <View className={`px-2.5 py-1 rounded-full flex-row items-center self-start ${bgStyle} ${className}`}>
      <Text className={`text-xs font-semibold uppercase tracking-wider ${textStyle}`}>{label}</Text>
    </View>
  );
};

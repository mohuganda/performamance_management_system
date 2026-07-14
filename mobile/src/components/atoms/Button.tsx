import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../app/hooks/useTheme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  className = '',
}) => {
  const { isDark } = useTheme();

  let bgStyle = 'bg-primary dark:bg-white'; // default primary black / white in dark mode
  let textStyle = 'text-white dark:text-zinc-950 font-semibold';

  if (variant === 'secondary') {
    bgStyle = 'bg-gray-200 dark:bg-zinc-800';
    textStyle = 'text-gray-800 dark:text-zinc-200 font-semibold';
  } else if (variant === 'danger') {
    bgStyle = 'bg-[#D90000] dark:bg-red-600';
    textStyle = 'text-white font-semibold';
  }

  if (disabled || loading) {
    bgStyle += ' opacity-50';
  }

  // Determine ActivityIndicator color
  let loaderColor = '#FFFFFF';
  if (variant === 'secondary') {
    loaderColor = isDark ? '#D1D5DB' : '#374151';
  } else if (variant === 'primary') {
    loaderColor = isDark ? '#1A1A1A' : '#FFFFFF';
  }

  return (
    <TouchableOpacity
      className={`px-4 py-3.5 rounded-xl flex-row justify-center items-center ${bgStyle} ${className}`}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={loaderColor} size="small" />
      ) : (
        <Text className={`text-base text-center ${textStyle}`}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

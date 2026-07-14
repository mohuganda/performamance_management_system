import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';

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
  let bgStyle = 'bg-primary'; // default primary black
  let textStyle = 'text-white font-semibold';

  if (variant === 'secondary') {
    bgStyle = 'bg-gray-200';
    textStyle = 'text-gray-800 font-semibold';
  } else if (variant === 'danger') {
    bgStyle = 'bg-[#D90000]';
    textStyle = 'text-white font-semibold';
  }

  if (disabled || loading) {
    bgStyle += ' opacity-50';
  }

  return (
    <TouchableOpacity
      className={`px-4 py-3.5 rounded-xl flex-row justify-center items-center ${bgStyle} ${className}`}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? '#374151' : '#FFFFFF'} size="small" />
      ) : (
        <Text className={`text-base text-center ${textStyle}`}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

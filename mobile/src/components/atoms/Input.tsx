import React, { useState } from 'react';
import { TextInput, View, Text, TextInputProps } from 'react-native';
import { useTheme } from '../../app/hooks/useTheme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const { isDark } = useTheme();

  return (
    <View className={`space-y-1.5 rounded-none ${className}`}>
      {label && (
        <Text className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{label}</Text>
      )}
      <View
        className={`w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-none px-4 py-3 flex-row items-center ${error
          ? 'border-[#D90000] dark:border-red-500'
          : isFocused
            ? 'border-primary dark:border-white'
            : 'border-gray-200 dark:border-zinc-800'
          }`}
      >
        <TextInput
          className="flex-1 text-base text-gray-900 dark:text-zinc-50 p-0"
          placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
      </View>
      {error && (
        <Text className="text-xs text-[#D90000] dark:text-red-500 font-medium mt-0.5">{error}</Text>
      )}
    </View>
  );
};

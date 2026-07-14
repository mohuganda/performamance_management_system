import React, { useState } from 'react';
import { TextInput, View, Text, TextInputProps } from 'react-native';

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

  return (
    <View className={`space-y-1.5 ${className}`}>
      {label && (
        <Text className="text-sm font-medium text-gray-700">{label}</Text>
      )}
      <View
        className={`w-full bg-white border rounded-xl px-4 py-3 flex-row items-center ${
          error
            ? 'border-[#D90000]'
            : isFocused
            ? 'border-[#15803D]'
            : 'border-gray-200'
        }`}
      >
        <TextInput
          className="flex-1 text-base text-gray-900 p-0"
          placeholderTextColor="#9CA3AF"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
      </View>
      {error && (
        <Text className="text-xs text-[#D90000] font-medium mt-0.5">{error}</Text>
      )}
    </View>
  );
};

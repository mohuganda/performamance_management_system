import React from 'react';
import { View, Text } from 'react-native';

interface FormFieldProps {
  label?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  className = '',
  children,
}) => {
  return (
    <View className={`space-y-1 rounded-none ${className}`}>
      {label && (
        <Text className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1">{label}</Text>
      )}
      {children}
      {error && (
        <Text className="text-xs text-[#D90000] dark:text-red-500 font-medium mt-1">{error}</Text>
      )}
    </View>
  );
};

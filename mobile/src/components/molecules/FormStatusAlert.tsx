import React from 'react';
import { View, Text } from 'react-native';
import { AlertCircle, CheckCircle } from 'lucide-react-native';
import { useTheme } from '../../app/hooks/useTheme';

interface FormStatusAlertProps {
  message: string | null;
  type?: 'success' | 'error' | 'warning';
  className?: string;
}

export const FormStatusAlert: React.FC<FormStatusAlertProps> = ({
  message,
  type = 'error',
  className = '',
}) => {
  const { colors } = useTheme();

  if (!message) return null;

  let bgClass = 'bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50';
  let textClass = 'text-red-700 dark:text-red-400';
  let Icon = AlertCircle;

  if (type === 'success') {
    bgClass = 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50';
    textClass = 'text-emerald-700 dark:text-emerald-400';
    Icon = CheckCircle;
  } else if (type === 'warning') {
    bgClass = 'bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50';
    textClass = 'text-amber-700 dark:text-amber-400';
    Icon = AlertCircle;
  }

  const iconColor = type === 'success' ? colors.success : type === 'warning' ? colors.warning : colors.error;

  return (
    <View className={`flex-row items-center p-4 rounded-none ${bgClass} ${className}`}>
      <Icon size={20} color={iconColor} className="mr-3" />
      <Text className={`text-sm font-medium flex-1 ${textClass}`}>{message}</Text>
    </View>
  );
};

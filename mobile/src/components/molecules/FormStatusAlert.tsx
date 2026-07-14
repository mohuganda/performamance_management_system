import React from 'react';
import { View, Text } from 'react-native';
import { AlertCircle, CheckCircle } from 'lucide-react-native';

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
  if (!message) return null;

  let bgClass = 'bg-red-50 border border-red-100';
  let textClass = 'text-red-700';
  let Icon = AlertCircle;

  if (type === 'success') {
    bgClass = 'bg-emerald-50 border border-emerald-100';
    textClass = 'text-emerald-700';
    Icon = CheckCircle;
  } else if (type === 'warning') {
    bgClass = 'bg-amber-50 border border-amber-100';
    textClass = 'text-amber-700';
    Icon = AlertCircle;
  }

  return (
    <View className={`flex-row items-center p-4 rounded-xl ${bgClass} ${className}`}>
      <Icon size={20} color={type === 'success' ? '#15803D' : type === 'warning' ? '#B45309' : '#D90000'} className="mr-3" />
      <Text className={`text-sm font-medium flex-1 ${textClass}`}>{message}</Text>
    </View>
  );
};

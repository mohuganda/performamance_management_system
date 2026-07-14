import React from 'react';
import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  className?: string;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <View
      className={`bg-white p-5 rounded-2xl border border-gray-100 shadow-sm ${className}`}
      {...props}
    >
      {children}
    </View>
  );
};

import React from 'react';
import { useTheme } from '../../hooks/useTheme';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', style, ...props }) => {
  const { colors } = useTheme();

  return (
    <div
      className={`p-5 rounded-none border shadow-sm ${className}`}
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

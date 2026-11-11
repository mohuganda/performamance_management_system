import React from 'react';
import { useTheme } from '../../hooks/useTheme';

interface LayoutTemplateProps {
  children: React.ReactNode;
  className?: string;
}

export const LayoutTemplate: React.FC<LayoutTemplateProps> = ({ children, className = '' }) => {
  const { colors } = useTheme();

  return (
    <div
      className={`min-h-screen pb-24 transition-colors ${className}`}
      style={{ backgroundColor: colors.background }}
    >
      <div className="max-w-md mx-auto">
        {children}
      </div>
    </div>
  );
};


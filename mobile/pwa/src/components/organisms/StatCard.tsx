import React from 'react';
import { useTheme } from '../../hooks/useTheme';

export interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color,
  onClick,
}) => {
  const { colors } = useTheme();

  return (
    <button
      onClick={onClick}
      className="w-[48%] mb-3 rounded-none border p-4 shadow-sm text-left transition-all hover:opacity-90 active:scale-[0.99] flex flex-col justify-between"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderTopWidth: '4px',
        borderTopColor: color,
      }}
    >
      <div className="flex items-center mb-3 w-full">
        <span className="flex-shrink-0">{icon}</span>
        <span
          className="ml-2 text-xs font-bold uppercase tracking-wider truncate flex-1"
          style={{ color: colors.muted }}
        >
          {title}
        </span>
      </div>
      <div className="w-full text-right">
        <p className="text-3xl font-black leading-none" style={{ color: colors.text }}>
          {value}
        </p>
        {subtitle && (
          <p
            className="text-[10px] font-bold mt-1 uppercase tracking-wider"
            style={{ color: colors.muted }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </button>
  );
};


import React, { ReactNode } from 'react';
import { useTheme } from '../../hooks/useTheme';

interface ActionCardProps {
  title: string;
  subtitle: string;
  icon: ReactNode;
  iconBgClass?: string;
  onClick: () => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  title,
  subtitle,
  icon,
  iconBgClass,
  onClick,
}) => {
  const { colors } = useTheme();

  return (
    <button
      onClick={onClick}
      className="w-[48%] p-4 rounded-none flex flex-col items-center border mb-3 text-center transition-all hover:opacity-90 active:scale-[0.99]"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
      }}
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
          iconBgClass || 'bg-gray-100 dark:bg-gray-800'
        }`}
      >
        {icon}
      </div>
      <h3
        className="text-sm font-bold text-center leading-snug w-full"
        style={{ color: colors.text }}
      >
        {title}
      </h3>
      <p
        className="text-[10px] mt-0.5 text-center leading-tight line-clamp-2 w-full"
        style={{ color: colors.muted }}
      >
        {subtitle}
      </p>
    </button>
  );
};


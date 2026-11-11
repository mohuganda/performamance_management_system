import React from 'react';
import { ChevronRight, LucideIcon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface QuickActionCardProps {
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  iconColor: string;
  iconBgClass: string;
  className?: string;
  onClick: () => void;
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  subtitle,
  Icon,
  iconColor,
  iconBgClass,
  className = '',
  onClick,
}) => {
  const { colors } = useTheme();

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-5 rounded-none border text-left transition-all hover:opacity-90 active:scale-[0.99] ${className}`}
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
      }}
    >
      <div className="flex items-center space-x-4 flex-1 mr-2">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 flex-shrink-0 ${iconBgClass}`}
        >
          <Icon size={22} color={iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-base font-bold truncate leading-tight" style={{ color: colors.text }}>
            {title}
          </h4>
          <p className="text-xs opacity-75 mt-0.5 leading-snug" style={{ color: colors.muted }}>
            {subtitle}
          </p>
        </div>
      </div>
      <ChevronRight size={18} style={{ color: colors.muted }} className="flex-shrink-0" />
    </button>
  );
};
export default QuickActionCard;


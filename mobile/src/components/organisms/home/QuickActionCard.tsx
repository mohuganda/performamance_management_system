import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronRight, LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../../app/hooks/useTheme';

interface QuickActionCardProps {
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  iconColor: string;
  iconBgClass: string;
  className?: string;
  onPress: () => void;
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  subtitle,
  Icon,
  iconColor,
  iconBgClass,
  className,
  onPress,
}) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className={`flex-row items-center justify-between p-5 rounded-none border ${className}`}
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-center space-x-4 flex-1">
        <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${iconBgClass}`}>
          <Icon size={22} color={iconColor} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold" style={{ color: colors.text }}>
            {title}
          </Text>
          <Text className="text-xs opacity-75 mt-0.5" style={{ color: colors.muted }}>
            {subtitle}
          </Text>
        </View>
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </TouchableOpacity>
  );
};
export default QuickActionCard;

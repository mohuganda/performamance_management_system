import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useTheme } from '../../app/hooks/useTheme';

interface NotificationIconProps {
  onPress: () => void;
  badgeCount?: number;
}

export const NotificationIcon: React.FC<NotificationIconProps> = ({
  onPress,
  badgeCount = 3,
}) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      className="relative p-2 rounded-full items-center justify-center"
      style={{ backgroundColor: colors.border + '33' }}
      activeOpacity={0.7}
    >
      <Bell size={22} color={colors.text} />
      {badgeCount > 0 && (
        <View
          className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full items-center justify-center px-1 bg-red-600 border border-white"
          style={{ borderColor: colors.surface }}
        >
          <Text className="text-[9px] font-bold text-white text-center leading-none">
            {badgeCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

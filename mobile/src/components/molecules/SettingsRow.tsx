import React from 'react';
import { View, Text, Switch, TouchableOpacity, StyleProp, ViewStyle, ActivityIndicator } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../app/hooks/useTheme';

export interface SettingsRowProps {
  label: string;
  subtitle?: string;
  icon?: React.ComponentType<{ size: number; color: string; className?: string }>;
  type: 'toggle' | 'link' | 'info';
  value?: boolean; // for toggle
  onValueChange?: (value: boolean) => void; // for toggle
  onPress?: () => void; // for link
  infoValue?: string; // for info
  loading?: boolean; // for loading spinner states
  isLast?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  label,
  subtitle,
  icon: Icon,
  type,
  value = false,
  onValueChange,
  onPress,
  infoValue,
  loading = false,
  isLast = false,
  style,
}) => {
  const { colors, isDark } = useTheme();

  const renderRightElement = () => {
    if (type === 'toggle') {
      return (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: isDark ? '#3F3F46' : '#E4E4E7', true: colors.primary }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={isDark ? '#3F3F46' : '#E4E4E7'}
        />
      );
    }
    if (type === 'link') {
      return <ChevronRight size={18} color={colors.muted} />;
    }
    if (type === 'info') {
      return (
        <Text className="text-sm font-bold" style={{ color: colors.text }}>
          {infoValue}
        </Text>
      );
    }
    return null;
  };

  const iconBgColor = colors.border + '33'; // transparent border color for icon bg

  const content = (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-3 flex-1">
        {Icon && (
          <View
            className="w-9 h-9 rounded-full items-center justify-center"
            style={{ backgroundColor: iconBgColor }}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.text} style={{ transform: [{ scale: 0.8 }] }} />
            ) : (
              <Icon size={18} color={colors.text} />
            )}
          </View>
        )}
        <View className="ml-1 flex-1 pr-2">
          {type === 'info' ? (
            <Text className="text-sm font-semibold" style={{ color: colors.muted }}>
              {label}
            </Text>
          ) : (
            <Text className="text-base font-bold" style={{ color: colors.text }}>
              {label}
            </Text>
          )}
          {subtitle && (
            <Text className="text-xs opacity-75 mt-0.5" style={{ color: colors.muted }}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      <View className="items-end justify-center">{renderRightElement()}</View>
    </View>
  );

  const rowStyle: ViewStyle = {
    paddingVertical: 12,
    borderBottomWidth: isLast ? 0 : 1,
    borderBottomColor: colors.border,
  };

  if (type === 'link') {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        disabled={loading}
        className="rounded-none"
        style={[rowStyle, style]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View className="rounded-none" style={[rowStyle, style]}>
      {content}
    </View>
  );
};

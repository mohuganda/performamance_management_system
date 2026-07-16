import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../app/hooks/useTheme';

interface SettingsSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  children,
  className = '',
}) => {
  const { colors } = useTheme();

  return (
    <View className={`mb-4 ${className}`}>
      {title && (
        <Text className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: colors.muted }}>
          {title}
        </Text>
      )}
      <View
        className="border rounded-none p-4"
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
        }}
      >
        {children}
      </View>
    </View>
  );
};

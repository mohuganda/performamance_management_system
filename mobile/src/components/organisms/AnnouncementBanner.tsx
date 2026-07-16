import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../app/hooks/useTheme';

interface AnnouncementBannerProps {
  title?: string;
  description?: string;
}

export function AnnouncementBanner({ title, description }: AnnouncementBannerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View
      className="p-4 rounded-none border"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-center">
        <View
          className="w-2.5 h-2.5 rounded-full mr-2"
          style={{ backgroundColor: colors.primary }}
        />
        <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: colors.text }}>
          {t('announcement')}
        </Text>
      </View>
      <Text className="text-sm font-semibold mt-2" style={{ color: colors.text }}>
        {title || t('home_announcement_title')}
      </Text>
      <Text className="text-xs mt-1" style={{ color: colors.muted }}>
        {description || t('home_announcement_description')}
      </Text>
    </View>
  );
}

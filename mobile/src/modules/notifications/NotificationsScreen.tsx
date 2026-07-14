import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MainTemplate } from '../../components/templates';

export function NotificationsScreen() {
  const { t } = useTranslation();

  return (
    <MainTemplate title={t('notifications_title')} showBack={true}>
      <View className="flex-1 items-center justify-center">
        <Text className="text-lg font-bold text-gray-700">{t('notifications_placeholder_text')}</Text>
      </View>
    </MainTemplate>
  );
}

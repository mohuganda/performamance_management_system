import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MainTemplate } from '../../components/templates';

export function OosScreen() {
  const { t } = useTranslation();

  return (
    <MainTemplate title={t('oos_title')} showBack={true}>
      <View className="flex-1 items-center justify-center">
        <Text className="text-lg font-bold text-gray-700">{t('oos_placeholder_text')}</Text>
      </View>
    </MainTemplate>
  );
}

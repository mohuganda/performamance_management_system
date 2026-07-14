import React from 'react';
import { View, Text } from 'react-native';
import { MainTemplate } from '../../components/templates';

export function NotificationsScreen() {
  return (
    <MainTemplate title="Notifications" showBack={true}>
      <View className="flex-1 items-center justify-center">
        <Text className="text-lg font-bold text-gray-700">Notifications Screen</Text>
      </View>
    </MainTemplate>
  );
}

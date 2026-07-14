import React from 'react';
import { View, Text } from 'react-native';
import { MainTemplate } from '../../components/templates';

export function OosScreen() {
  return (
    <MainTemplate title="Out of Station">
      <View className="flex-1 items-center justify-center">
        <Text className="text-lg font-bold text-gray-700">Out of Station Screen</Text>
      </View>
    </MainTemplate>
  );
}

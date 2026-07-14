import React from 'react';
import { View, Text } from 'react-native';
import { MainTemplate } from '../../components/templates';

export function ApprovalsScreen() {
  return (
    <MainTemplate title="Approvals">
      <View className="flex-1 items-center justify-center">
        <Text className="text-lg font-bold text-gray-700">Approvals Screen</Text>
      </View>
    </MainTemplate>
  );
}

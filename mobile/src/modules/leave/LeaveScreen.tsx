import React from 'react';
import { View, Text } from 'react-native';
import { MainTemplate } from '../../components/templates';

export function LeaveScreen() {
  return (
    <MainTemplate title="Leave Management">
      <View className="flex-1 items-center justify-center">
        <Text className="text-lg font-bold text-gray-700">Leave Management Screen</Text>
      </View>
    </MainTemplate>
  );
}

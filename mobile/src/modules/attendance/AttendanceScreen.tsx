import React from 'react';
import { View, Text } from 'react-native';
import { MainTemplate } from '../../components/templates';

export function AttendanceScreen() {
  return (
    <MainTemplate title="Attendance">
      <View className="flex-1 items-center justify-center">
        <Text className="text-lg font-bold text-gray-700">Attendance Screen</Text>
      </View>
    </MainTemplate>
  );
}

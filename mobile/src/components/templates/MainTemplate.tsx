import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AlertCircle } from 'lucide-react-native';

import { Screen } from './Screen';
import { AppBar } from '../organisms/common/AppBar';
import { useSyncStore } from '../../stores/syncStore';

interface MainTemplateProps {
  title: string;
  children: React.ReactNode;
  showBack?: boolean;
  rightElement?: React.ReactNode;
}

export const MainTemplate = ({
  title,
  children,
  showBack = false,
  rightElement,
}: MainTemplateProps) => {
  const navigation = useNavigation<any>();
  const failedQueue = useSyncStore((state) => state.failedQueue);
  const failedCount = failedQueue.length;

  return (
    <Screen className="bg-background">
      <AppBar title={title} showBack={showBack} rightElement={rightElement} />
      
      {failedCount > 0 && (
        <TouchableOpacity 
          className="bg-red-500 px-4 py-3 flex-row items-center justify-between"
          onPress={() => navigation.navigate('SyncIssues')}
        >
          <View className="flex-row items-center flex-1 pr-2">
            <AlertCircle size={20} color="white" />
            <Text className="text-white font-bold ml-2 flex-1">
              ⚠️ {failedCount} request{failedCount > 1 ? 's' : ''} failed to sync. Tap to review.
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {children}
    </Screen>
  );
};

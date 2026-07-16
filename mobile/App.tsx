import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from './src/stores/authStore';
import { AuthNavigator } from './src/app/navigation/AuthNavigator';
import { AppNavigator } from './src/app/navigation/AppNavigator';
import { initNetworkListener } from './src/utils/network';
import { queryClient, mmkvStoragePersister } from './src/app/queryClient';
import { LogBox } from 'react-native';

LogBox.ignoreAllLogs();

export default function App() {
  const { isAuthenticated, hydrateToken, authReady } = useAuthStore();

  useEffect(() => {
    hydrateToken();
    const unsubscribe = initNetworkListener();
    return () => {
      unsubscribe();
    };
  }, [hydrateToken]);

  if (!authReady) {
    return null; // display blank layout while Zustand state MMKV resolves
  }

  return (
    // eslint-disable-next-line react-native/no-inline-styles
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: mmkvStoragePersister }}
      >
        <SafeAreaProvider>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
          <NavigationContainer>
            {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
          </NavigationContainer>
        </SafeAreaProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}

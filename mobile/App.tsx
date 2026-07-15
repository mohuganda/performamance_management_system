import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from './src/stores/authStore';
import { AuthNavigator } from './src/app/navigation/AuthNavigator';
import { AppNavigator } from './src/app/navigation/AppNavigator';
import { initNetworkListener } from './src/utils/network';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
          <NavigationContainer>
            {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
          </NavigationContainer>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

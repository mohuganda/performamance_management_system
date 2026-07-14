import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from './src/stores/authStore';
import { AuthNavigator } from './src/app/navigation/AuthNavigator';
import { AppNavigator } from './src/app/navigation/AppNavigator';

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
  }, [hydrateToken]);

  if (!authReady) {
    return null; // display blank layout while Zustand state MMKV resolves
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <NavigationContainer>
          {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
        </NavigationContainer>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

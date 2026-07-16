import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { createMMKV } from 'react-native-mmkv';

const queryCacheStorage = createMMKV({ id: 'moh-pms-query-cache' });

export const mmkvStoragePersister = createSyncStoragePersister({
  storage: {
    setItem: (key, value) => queryCacheStorage.set(key, value),
    getItem: (key) => queryCacheStorage.getString(key) ?? null,
    removeItem: (key) => queryCacheStorage.remove(key),
  },
  throttleTime: 1000,
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24 * 7, // Keep cache for 7 days
      staleTime: 1000 * 60 * 5, // Data is fresh for 5 minutes
      networkMode: 'offlineFirst', // Run query function and serve cache if offline
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

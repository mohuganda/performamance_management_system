import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';
import axios from 'axios';
import syncService from '../api/sync/service';
import { QueuedMutation } from '../api/sync/types';

const syncStorage = createMMKV({ id: 'moh-pms-sync' });
const storageWrapper = {
  setItem: (name: string, value: string) => syncStorage.set(name, value),
  getItem: (name: string) => syncStorage.getString(name) ?? null,
  removeItem: (name: string) => syncStorage.remove(name),
};

export interface FailedQueuedMutation extends QueuedMutation {
  error?: string;
  failedAt: string;
}

interface SyncState {
  queue: QueuedMutation[];
  failedQueue: FailedQueuedMutation[];
  isSyncing: boolean;
  addMutation: (mutation: Omit<QueuedMutation, 'id'>) => void;
  processQueue: () => Promise<void>;
  clearFailedQueue: () => void;
  removeFromFailedQueue: (id: string) => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      queue: [],
      failedQueue: [],
      isSyncing: false,
      
      addMutation: (mutation) => {
        const id = Math.random().toString(36).substring(7);
        set((state) => ({ queue: [...state.queue, { ...mutation, id }] }));
        get().processQueue(); // attempt sync immediately if online
      },

      processQueue: async () => {
        const { queue, isSyncing } = get();
        if (queue.length === 0 || isSyncing) return;
        set({ isSyncing: true });

        const remainingQueue = [...queue];
        for (const mutation of queue) {
          try {
            await syncService.processMutation(mutation);
            remainingQueue.shift(); // remove item from top of queue on success
            set({ queue: [...remainingQueue] });
          } catch (err) {
            console.error('Failed to sync offline mutation', mutation.id, err);
            
            if (axios.isAxiosError(err)) {
              const status = err.response?.status;
              
              // 401 Unauthorized is retryable/paused because user needs to log back in
              if (status === 401) {
                console.warn('Authentication error (401) during sync. Pausing queue.');
                break;
              }
              
              // Non-retryable Client Errors (e.g. 400 Bad Request, 403 Forbidden, 409 Conflict, 422 Validation Error)
              if (status && status >= 400 && status < 500 && status !== 408) {
                console.warn(`Non-retryable error (${status}) for mutation ${mutation.id}. Moving to failed queue.`);
                
                remainingQueue.shift(); // Remove from processing queue to avoid blocking
                set((state) => ({
                  queue: [...remainingQueue],
                  failedQueue: [
                    ...(state.failedQueue || []),
                    {
                      ...mutation,
                      error: err.response?.data?.message || err.response?.data?.error || err.message,
                      failedAt: new Date().toISOString(),
                    },
                  ],
                }));
                continue; // Continue processing subsequent queue items!
              }
            }
            
            // Retryable error (no internet, server 5xx, timeouts) - Pause queue processing
            break;
          }
        }
        set({ isSyncing: false });
      },

      clearFailedQueue: () => set({ failedQueue: [] }),
      
      removeFromFailedQueue: (id) =>
        set((state) => ({
          failedQueue: (state.failedQueue || []).filter((item) => item.id !== id),
        })),
    }),
    {
      name: 'sync-queue-storage',
      storage: createJSONStorage(() => storageWrapper),
    }
  )
);


import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from '../utils/storage';
import axios from 'axios';
import syncService from '../api/sync/service';
import { QueuedMutation } from '../api/sync/types';

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
  discardFailedMutation: (id: string) => Promise<void>;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      queue: [],
      failedQueue: [],
      isSyncing: false,

      addMutation: (mutation) => {
        const id = Math.random().toString(36).substring(2, 11);
        set((state) => ({
          queue: [...state.queue, { ...mutation, id }],
        }));
        // If online, immediately try to sync
        if (navigator.onLine) {
          get().processQueue();
        }
      },

      processQueue: async () => {
        const { queue, isSyncing } = get();
        if (queue.length === 0 || isSyncing) return;
        set({ isSyncing: true });

        const remainingQueue = [...queue];
        for (const mutation of queue) {
          try {
            await syncService.processMutation(mutation);

            remainingQueue.shift();
            set({ queue: [...remainingQueue] });
          } catch (err) {
            console.error('Failed to sync offline mutation', mutation.id, err);

            if (axios.isAxiosError(err)) {
              const status = err.response?.status;

              if (status === 401) {
                console.warn('Authentication error (401) during sync. Pausing queue.');
                break;
              }

              if (status && status >= 400 && status < 500 && status !== 408) {
                console.warn(`Non-retryable error (${status}) for mutation ${mutation.id}. Moving to failed queue.`);

                const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message;

                remainingQueue.shift();
                set((state) => ({
                  queue: [...remainingQueue],
                  failedQueue: [
                    ...(state.failedQueue || []),
                    {
                      ...mutation,
                      error: errorMessage,
                      failedAt: new Date().toISOString(),
                    },
                  ],
                }));
                continue;
              }
            }
            break;
          }
        }
        set({ isSyncing: false });
      },

      clearFailedQueue: () => set({ failedQueue: [] }),
      removeFromFailedQueue: (id) =>
        set((state) => ({ failedQueue: state.failedQueue.filter((m) => m.id !== id) })),

      discardFailedMutation: async (id: string) => {
        get().removeFromFailedQueue(id);
      },
    }),
    {
      name: 'sync-queue-storage',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);


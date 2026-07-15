import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';
import syncService from '../api/sync/service';
import { QueuedMutation } from '../api/sync/types';

const syncStorage = createMMKV({ id: 'moh-pms-sync' });
const storageWrapper = {
  setItem: (name: string, value: string) => syncStorage.set(name, value),
  getItem: (name: string) => syncStorage.getString(name) ?? null,
  removeItem: (name: string) => syncStorage.remove(name),
};

interface SyncState {
  queue: QueuedMutation[];
  isSyncing: boolean;
  addMutation: (mutation: Omit<QueuedMutation, 'id'>) => void;
  processQueue: () => Promise<void>;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      queue: [],
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
            break; // Stop execution of the queue to keep order; retry on next connectivity change
          }
        }
        set({ isSyncing: false });
      },
    }),
    {
      name: 'sync-queue-storage',
      storage: createJSONStorage(() => storageWrapper),
    }
  )
);

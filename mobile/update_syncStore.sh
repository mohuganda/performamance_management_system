#!/bin/bash

# Update syncStore processQueue
cat << 'INNER_EOF' > /tmp/patch_syncStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage } from '../utils/asyncStorage';
import axios from 'axios';
import syncService from '../api/sync/service';
import { QueuedMutation } from '../api/sync/types';
import { database } from '../db';
import { Model } from '@nozbe/watermelondb';

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
        set((state) => ({
          queue: [...state.queue, { ...mutation, id: Math.random().toString(36).substr(2, 9) }],
        }));
      },

      processQueue: async () => {
        const { queue, isSyncing } = get();
        if (queue.length === 0 || isSyncing) return;
        set({ isSyncing: true });

        const remainingQueue = [...queue];
        for (const mutation of queue) {
          try {
            const response = await syncService.processMutation(mutation);
            
            // Phase 10: Reconciliation - Update local record with server response
            if (mutation.localRecordId && mutation.modelTable) {
              await database.write(async () => {
                try {
                  const collection = database.collections.get<Model & { remoteId?: number | null, status?: string }>(mutation.modelTable!);
                  const record = await collection.find(mutation.localRecordId!);
                  await record.update((r: any) => {
                    if (response.id !== undefined) r.remoteId = response.id;
                    if (response.status !== undefined) r.status = response.status;
                  });
                } catch (e) {
                  console.warn('Could not find or update local record during reconciliation', e);
                }
              });
            }

            remainingQueue.shift(); // remove item from top of queue on success
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
                
                remainingQueue.shift();
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
                continue;
              }
            }
            break;
          }
        }
        set({ isSyncing: false });
      },

      clearFailedQueue: () => set({ failedQueue: [] }),
      removeFromFailedQueue: (id) => set((state) => ({ failedQueue: state.failedQueue.filter((m) => m.id !== id) })),
    }),
    {
      name: 'sync-queue-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);
INNER_EOF

mv /tmp/patch_syncStore.ts src/stores/syncStore.ts


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
  discardFailedMutation: (id: string) => Promise<void>;
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
            
            if (mutation.localRecordId && mutation.modelTable) {
              await database.write(async () => {
                try {
                  const collection = database.collections.get<Model & { remoteId?: number | null, status?: string, syncError?: string | null }>(mutation.modelTable!);
                  const record = await collection.find(mutation.localRecordId!);
                  await record.update((r: any) => {
                    if (response.id !== undefined) r.remoteId = response.id;
                    if (response.status !== undefined) r.status = response.status;
                    r.syncError = null;
                  });
                } catch (e) {
                  console.warn('Could not find or update local record during reconciliation', e);
                }
              });
            }

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
                
                // Phase 11: Conflict Resolution - Tag local record
                if (mutation.localRecordId && mutation.modelTable) {
                  await database.write(async () => {
                    try {
                      const collection = database.collections.get<Model & { status?: string, syncError?: string | null }>(mutation.modelTable!);
                      const record = await collection.find(mutation.localRecordId!);
                      await record.update((r: any) => {
                        r.status = 'sync_failed';
                        r.syncError = errorMessage;
                      });
                    } catch (e) {
                      console.warn('Could not tag local record with sync error', e);
                    }
                  });
                }

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
      removeFromFailedQueue: (id) => set((state) => ({ failedQueue: state.failedQueue.filter((m) => m.id !== id) })),
      
      discardFailedMutation: async (id: string) => {
        const { failedQueue, removeFromFailedQueue } = get();
        const mutation = failedQueue.find(m => m.id === id);
        
        if (mutation && mutation.localRecordId && mutation.modelTable) {
          await database.write(async () => {
            try {
              const collection = database.collections.get<Model>(mutation.modelTable!);
              const record = await collection.find(mutation.localRecordId!);
              await record.destroyPermanently();
            } catch (e) {
              console.warn('Failed to delete local record for discarded mutation', e);
            }
          });
        }
        
        removeFromFailedQueue(id);
      },
    }),
    {
      name: 'sync-queue-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);

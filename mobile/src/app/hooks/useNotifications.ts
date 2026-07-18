import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import notificationService from '../../api/notifications/service';
import { useAuthStore } from '../../stores/authStore';
import { NotificationDbService } from '../../db/services/NotificationDbService';
import { useSyncStore } from '../../stores/syncStore';

export const NOTIFICATIONS_KEYS = {
  all: ['notifications'] as const,
  lists: () => [...NOTIFICATIONS_KEYS.all, 'list'] as const,
  list: (filters: string) => [...NOTIFICATIONS_KEYS.lists(), { filters }] as const,
  unreadCount: () => [...NOTIFICATIONS_KEYS.all, 'unreadCount'] as const,
};

export function useUnreadCountQuery() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // We could query the DB, but since it's just a number, we can let it fetch and 
  // we can also use withObservables in the UI if needed.
  return useQuery({
    queryKey: NOTIFICATIONS_KEYS.unreadCount(),
    queryFn: () => notificationService.unreadCount(),
    enabled: isAuthenticated,
    refetchInterval: 60000, // Poll every minute for new notifications
  });
}

export function useNotificationsInfiniteQuery(unreadOnly = false) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: NOTIFICATIONS_KEYS.list(unreadOnly ? 'unread' : 'all'),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await notificationService.list({
        page: pageParam,
        per_page: 20,
        unread_only: unreadOnly ? true : undefined,
      });
      
      // Sink the results into the local DB
      await NotificationDbService.syncNotifications(response.data);
      return response;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.current_page < lastPage.last_page) {
        return lastPage.current_page + 1;
      }
      return undefined;
    },
    enabled: isAuthenticated,
  });
}

export function useMarkReadMutation() {
  const queryClient = useQueryClient();
  const { addMutation } = useSyncStore();

  return useMutation({
    mutationFn: async (id: number) => {
      // Optimistic local DB update
      await NotificationDbService.markReadOptimistic(id);
      
      try {
        await notificationService.markRead(id);
      } catch (error: any) {
        // If offline, queue the action
        if (!error.response) {
          addMutation({
            type: 'MARK_NOTIFICATION_READ',
            endpoint: `/notifications/${id}/read`,
            method: 'PUT',
            payload: {},
          });
          return { offline: true };
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEYS.unreadCount() });
    },
  });
}

export function useMarkAllReadMutation() {
  const queryClient = useQueryClient();
  const { addMutation } = useSyncStore();

  return useMutation({
    mutationFn: async () => {
      await NotificationDbService.markAllReadOptimistic();

      try {
        await notificationService.markAllRead();
      } catch (error: any) {
        if (!error.response) {
          addMutation({
            type: 'MARK_ALL_NOTIFICATIONS_READ',
            endpoint: '/notifications/mark-all-read',
            method: 'PUT',
            payload: {},
          });
          return { offline: true };
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEYS.unreadCount() });
    },
  });
}

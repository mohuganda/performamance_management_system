import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import notificationService from '../../api/notifications/service';
import { useAuthStore } from '../../stores/authStore';

export const NOTIFICATIONS_KEYS = {
  all: ['notifications'] as const,
  lists: () => [...NOTIFICATIONS_KEYS.all, 'list'] as const,
  list: (filters: string) => [...NOTIFICATIONS_KEYS.lists(), { filters }] as const,
  unreadCount: () => [...NOTIFICATIONS_KEYS.all, 'unreadCount'] as const,
};

export function useUnreadCountQuery() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

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
      return notificationService.list({
        page: pageParam,
        per_page: 20,
        unread_only: unreadOnly ? true : undefined,
      });
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

  return useMutation({
    mutationFn: (id: number) => notificationService.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEYS.all });
    },
  });
}

export function useMarkAllReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEYS.all });
    },
  });
}

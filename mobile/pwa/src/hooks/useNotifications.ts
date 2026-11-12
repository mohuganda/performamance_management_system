import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import notificationsService from '../api/notifications/service';
import { NotificationRow } from '../api/notifications/types';
import { useAuthStore } from '../stores/authStore';

export const NOTIFICATION_QUERY_KEYS = {
  all: ['notifications'] as const,
  unreadCount: (userId?: number | string | null) =>
    [...NOTIFICATION_QUERY_KEYS.all, userId ?? 'anonymous', 'unread-count'] as const,
  list: (userId?: number | string | null, unreadOnly?: boolean) =>
    [...NOTIFICATION_QUERY_KEYS.all, userId ?? 'anonymous', 'list', unreadOnly] as const,
};

export function useUnreadCountQuery() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id || s.staffId);

  return useQuery<number, Error>({
    queryKey: NOTIFICATION_QUERY_KEYS.unreadCount(userId),
    queryFn: () => notificationsService.unreadCount(),
    enabled: Boolean(isAuthenticated && userId),
    refetchInterval: 60 * 1000,
  });
}

export function useNotificationsQuery(unreadOnly = false) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id || s.staffId);

  return useQuery<NotificationRow[], Error>({
    queryKey: NOTIFICATION_QUERY_KEYS.list(userId, unreadOnly),
    queryFn: async () => {
      const res = await notificationsService.list({ unread_only: unreadOnly });
      return res.data;
    },
    enabled: Boolean(isAuthenticated && userId),
    staleTime: 60 * 1000,
  });
}

export function useMarkReadMutation() {
  const queryClient = useQueryClient();

  return useMutation<any, Error, number>({
    mutationFn: (id: number) => notificationsService.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all });
    },
  });
}

export function useMarkAllReadMutation() {
  const queryClient = useQueryClient();

  return useMutation<any, Error, void>({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import notificationsService from '../api/notifications/service';
import { NotificationRow } from '../api/notifications/types';
import { useAuthStore } from '../stores/authStore';

export const NOTIFICATION_QUERY_KEYS = {
  all: ['notifications'] as const,
  unreadCount: () => [...NOTIFICATION_QUERY_KEYS.all, 'unread-count'] as const,
  list: (unreadOnly?: boolean) => [...NOTIFICATION_QUERY_KEYS.all, 'list', unreadOnly] as const,
};

export function useUnreadCountQuery() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery<number, Error>({
    queryKey: NOTIFICATION_QUERY_KEYS.unreadCount(),
    queryFn: () => notificationsService.unreadCount(),
    enabled: isAuthenticated,
    refetchInterval: 60 * 1000,
  });
}

export function useNotificationsQuery(unreadOnly = false) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery<NotificationRow[], Error>({
    queryKey: NOTIFICATION_QUERY_KEYS.list(unreadOnly),
    queryFn: async () => {
      const res = await notificationsService.list({ unread_only: unreadOnly });
      return res.data;
    },
    enabled: isAuthenticated,
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

import apiClient from '../client';
import { PaginatedNotifications } from './types';

const notificationService = {
  unreadCount: async (): Promise<number> => {
    const { data } = await apiClient.get('/notifications/unread-count');
    // The backend might wrap the data in a `data` object based on frontend implementation `unwrapApiData`
    return data?.data?.unread_count ?? data?.unread_count ?? 0;
  },

  list: async (params?: {
    unread_only?: boolean;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedNotifications> => {
    const { data } = await apiClient.get('/notifications', { params });
    // Handled depending on whether API wraps it in data or returns paginated object directly
    return data?.data?.data ? data.data : data;
  },

  markRead: async (id: number) => {
    const { data } = await apiClient.post(`/notifications/${id}/read`);
    return data;
  },

  markAllRead: async () => {
    const { data } = await apiClient.post('/notifications/read-all');
    return data;
  },
};

export default notificationService;

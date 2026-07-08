import apiClient from '../client'
import type { PaginatedResponse } from '@/types/pagination'
import { unwrapPaginated } from '@/types/pagination'
import { unwrapApiData } from '@/utils/unwrapApi'

export type NotificationRow = {
  id: number
  type: 'info' | 'warning' | 'success' | 'error'
  category: string
  title: string
  message: string
  action_url?: string
  read_at?: string | null
  created_at: string
  is_read: boolean
}

export const notificationService = {
  unreadCount: async (): Promise<number> => {
    const { data } = await apiClient.get('/notifications/unread-count')
    const payload = unwrapApiData<{ unread_count: number }>(data)
    return payload?.unread_count ?? 0
  },

  list: async (params?: {
    unread_only?: boolean
    page?: number
    per_page?: number
  }): Promise<PaginatedResponse<NotificationRow>> => {
    const { data } = await apiClient.get('/notifications', { params })
    return unwrapPaginated<NotificationRow>(data)
  },

  markRead: async (id: number) => {
    const { data } = await apiClient.post(`/notifications/${id}/read`)
    return data
  },

  markAllRead: async () => {
    const { data } = await apiClient.post('/notifications/read-all')
    return data
  },
}

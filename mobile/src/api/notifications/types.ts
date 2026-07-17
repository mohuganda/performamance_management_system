export type NotificationRow = {
  id: number;
  type: 'info' | 'warning' | 'success' | 'error';
  category: string;
  title: string;
  message: string;
  action_url?: string;
  read_at?: string | null;
  created_at: string;
  is_read: boolean;
};

export interface PaginatedNotifications {
  data: NotificationRow[];
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
}

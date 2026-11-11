import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { MainTemplate } from '../../components/templates';
import { Card } from '../../components/atoms/Card';
import { useTheme } from '../../hooks/useTheme';
import apiClient from '../../api/client';
import { NotificationRow } from '../../api/notifications/types';
import { formatDate } from '../../utils/date';

export const NotificationsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<NotificationRow[]>('/notifications');
      setNotifications(res.data);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAllAsRead = async () => {
    try {
      await apiClient.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // ignore
    }
  };

  return (
    <MainTemplate
      title={t('notifications_title', 'Notifications')}
      showBack
      rightElement={
        notifications.some((n) => !n.is_read) ? (
          <button
            onClick={markAllAsRead}
            className="text-xs font-semibold hover:underline"
            style={{ color: colors.text }}
          >
            Mark read
          </button>
        ) : undefined
      }
    >
      <div className="p-4 space-y-3">
        {notifications.length === 0 ? (
          <Card className="p-8 text-center text-xs" style={{ color: colors.muted }}>
            No system notifications at this time.
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((item) => (
              <Card
                key={item.id}
                className="p-4 space-y-1.5 transition-colors"
                style={{
                  borderLeftWidth: !item.is_read ? '4px' : undefined,
                  borderLeftColor: !item.is_read ? '#2563EB' : undefined,
                }}
              >
                <div className="flex items-start justify-between">
                  <h4 className="text-sm font-bold leading-tight" style={{ color: colors.text }}>
                    {item.title}
                  </h4>
                  {item.is_read ? (
                    <span className="text-[10px]" style={{ color: colors.muted }}>
                      Read
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                      New
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed" style={{ color: colors.muted }}>
                  {item.message}
                </p>
                <p className="text-[10px] pt-1" style={{ color: colors.muted }}>
                  {formatDate(item.created_at)}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainTemplate>
  );
};
export default NotificationsScreen;

import React from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../app/hooks/useTheme';
import { Card } from '../../atoms/Card';
import { NotificationRow } from '../../../api/notifications/types';
import { formatDisplayDate, parseISODate } from '../../../utils/leavePolicy';
import { Bell, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react-native';

interface NotificationCardProps {
  item: NotificationRow;
  onMarkRead: (id: number) => void;
}

export function NotificationCard({ item, onMarkRead }: NotificationCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const handlePress = () => {
    if (!item.is_read) {
      onMarkRead(item.id);
    }
    if (item.action_url) {
      // Simple handling for absolute URLs vs internal routes
      if (item.action_url.startsWith('http')) {
        Linking.openURL(item.action_url);
      }
      // In a full implementation, you might map action_url paths to deep links or navigation actions
    }
  };

  const renderIcon = (type: NotificationRow['type']) => {
    switch (type) {
      case 'info':
        return <Info size={24} color="#3B82F6" />;
      case 'warning':
        return <AlertTriangle size={24} color="#F59E0B" />;
      case 'success':
        return <CheckCircle size={24} color="#10B981" />;
      case 'error':
        return <XCircle size={24} color="#EF4444" />;
      default:
        return <Bell size={24} color={colors.primary} />;
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <Card className={`p-4 ${item.is_read ? 'opacity-70' : 'bg-blue-50 dark:bg-blue-950/20'}`}>
        <View className="flex-row items-start">
          <View className="mr-3 mt-1">
            {renderIcon(item.type)}
          </View>
          <View className="flex-1">
            <View className="flex-row justify-between items-start">
              <Text className={`text-sm font-bold flex-1 pr-2 ${item.is_read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-gray-100'}`}>
                {item.title}
              </Text>
              {!item.is_read && (
                <View className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
              )}
            </View>
            <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">
              {item.message}
            </Text>
            <View className="flex-row justify-between items-center mt-1">
              <Text className="text-[10px] text-gray-400 font-medium">
                {formatDisplayDate(parseISODate(item.created_at))}
              </Text>
              {item.action_url && (
                <Text className="text-[10px] font-bold">
                  {t('notifications_action_button')}
                </Text>
              )}
            </View>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

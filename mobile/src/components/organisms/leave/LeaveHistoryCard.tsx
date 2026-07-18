import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../app/hooks/useTheme';
import { Card } from '../../atoms/Card';
import { Badge } from '../../atoms/Badge';
import { LeaveRequest } from '../../../api/leave/types';
import { AlertTriangle } from 'lucide-react-native';

interface LeaveHistoryCardProps {
  item: LeaveRequest;
  typeName: string;
  displayStart: string;
  displayEnd: string;
  duration?: number;
}

export function LeaveHistoryCard({ item, typeName, displayStart, displayEnd, duration }: LeaveHistoryCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge label={t('leave_status_draft')} variant="gray" />;
      case 'pending_sync':
        return <Badge label={t('leave_status_pending_sync')} variant="info" />;
      case 'sync_failed':
        return <Badge label={t('leave_status_sync_failed', 'Sync Failed')} variant="error" />;
      case 'pending':
        return <Badge label={t('leave_status_pending')} variant="warning" />;
      case 'approved':
        return <Badge label={t('leave_status_approved')} variant="success" />;
      case 'rejected':
        return <Badge label={t('leave_status_rejected')} variant="error" />;
      default:
        return <Badge label={status} variant="gray" />;
    }
  };

  const isSyncFailed = item.status === 'sync_failed';

  return (
    <Card className={`p-4 space-y-3 ${isSyncFailed ? 'border-l-4 border-l-red-500' : ''}`}>
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-2">
          <Text className="text-base font-bold mb-1" style={{ color: colors.text }}>
            {typeName}
          </Text>
          <Text className="text-sm" style={{ color: colors.muted }}>
            {displayStart} - {displayEnd}
          </Text>
        </View>
        <View className="items-end">
          {renderStatusBadge(item.status)}
          {duration !== undefined && (
            <Text className="text-xs mt-1 font-medium" style={{ color: colors.muted }}>
              {duration} {duration === 1 ? t('common_day', 'Day') : t('common_days', 'Days')}
            </Text>
          )}
        </View>
      </View>
      
      {isSyncFailed && item.syncError && (
        <View className="bg-red-50 dark:bg-red-900/20 p-2 rounded mt-2 flex-row items-start">
          <AlertTriangle size={14} color="#ef4444" style={{ marginTop: 2, marginRight: 6 }} />
          <Text className="text-xs text-red-600 dark:text-red-400 flex-1">
            {item.syncError}
          </Text>
        </View>
      )}
    </Card>
  );
}

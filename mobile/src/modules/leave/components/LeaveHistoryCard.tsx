import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../app/hooks/useTheme';
import { Card } from '../../../components/atoms/Card';
import { Badge } from '../../../components/atoms/Badge';
import { LeaveRequest } from '../../../api/leave/types';

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

  return (
    <Card className="p-4 space-y-3">
      <View className="flex-row justify-between items-start">
        <View className="flex-1 pr-2">
          <Text className="text-base font-bold" style={{ color: colors.text }}>
            {typeName}
          </Text>
          <Text className="text-xs mt-1" style={{ color: colors.muted }}>
            {displayStart} — {displayEnd}
          </Text>
        </View>
        {renderStatusBadge(item.status)}
      </View>

      {duration !== undefined && (
        <View className="flex-row justify-between border-t border-b border-gray-50 dark:border-zinc-900 py-2 my-1">
          <Text className="text-xs font-semibold" style={{ color: colors.muted }}>
            Duration:
          </Text>
          <Text className="text-xs font-bold" style={{ color: colors.text }}>
            {t('leave_days_count', { count: duration })}
          </Text>
        </View>
      )}

      {/* {item.reason ? (
        <View className="space-y-1">
          <Text className="text-xs font-bold" style={{ color: colors.muted }}>
            Reason:
          </Text>
          <Text className="text-sm opacity-90" style={{ color: colors.text }}>
            {item.reason}
          </Text>
        </View>
      ) : null} */}
    </Card>
  );
}

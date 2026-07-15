import React from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../app/hooks/useTheme';
import { MainTemplate } from '../../components/templates';
import { Card } from '../../components/atoms/Card';
import { Badge } from '../../components/atoms/Badge';
import { useLeaveRequestsQuery, useLeaveTypesQuery } from '../../app/hooks/useLeave';
import { useSyncStore } from '../../stores/syncStore';
import { formatDisplayDate, parseISODate } from '../../utils/leavePolicy';

export function LeaveHistoryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  // Queries
  const { data: requests, isLoading: isRequestsLoading, refetch, isFetching } = useLeaveRequestsQuery();
  const { data: leaveTypes, isLoading: isTypesLoading } = useLeaveTypesQuery();

  // Sync Store (Offline Requests)
  const offlineQueue = useSyncStore((state) => state.queue);

  const handleRefresh = () => {
    refetch();
  };

  const typeMap = React.useMemo(() => {
    const map = new Map<number, string>();
    if (leaveTypes) {
      leaveTypes.forEach((t) => map.set(t.id, t.name));
    }
    return map;
  }, [leaveTypes]);

  // Combine offline-queued leave requests with central database records
  const combinedRequests = React.useMemo(() => {
    const offlineRequests = offlineQueue
      .filter((item) => item.type === 'LEAVE_REQUEST')
      .map((item, index) => {
        const payload = item.payload;
        return {
          id: `offline-${index}`,
          leave_type_id: Number(payload.leave_type_id),
          start_date: payload.start_date,
          end_date: payload.end_date,
          reason: payload.reason,
          status: 'pending_sync' as const,
          days_requested: undefined,
        };
      });

    const onlineRequests = requests || [];

    // Return combined list, with offline requests appearing first (as they are the newest local actions)
    return [...offlineRequests, ...onlineRequests];
  }, [requests, offlineQueue]);

  const isLoading = isRequestsLoading || isTypesLoading;

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
    <MainTemplate title={t('leave_history_title')} showBack={true}>
      {isLoading && !isFetching ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={combinedRequests}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
          ListEmptyComponent={
            <Card className="p-8 items-center justify-center">
              <Text className="text-base text-center" style={{ color: colors.muted }}>
                {t('leave_history_empty')}
              </Text>
            </Card>
          }
          ItemSeparatorComponent={() => <View className="h-4" />}
          renderItem={({ item }) => {
            const typeName = typeMap.get(item.leave_type_id) ?? 'Leave Request';
            const displayStart = item.start_date ? formatDisplayDate(parseISODate(item.start_date)) : '';
            const displayEnd = item.end_date ? formatDisplayDate(parseISODate(item.end_date)) : '';

            // Calculate duration if not provided by backend payload
            let duration = item.days_requested;
            if (!duration && item.start_date && item.end_date) {
              const start = parseISODate(item.start_date);
              const end = parseISODate(item.end_date);
              if (end >= start) {
                const diffTime = Math.abs(end.getTime() - start.getTime());
                duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
              }
            }

            return (
              <Card className="p-5 space-y-3">
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

                {item.reason ? (
                  <View className="space-y-1">
                    <Text className="text-xs font-bold" style={{ color: colors.muted }}>
                      Reason:
                    </Text>
                    <Text className="text-sm opacity-90" style={{ color: colors.text }}>
                      {item.reason}
                    </Text>
                  </View>
                ) : null}
              </Card>
            );
          }}
        />
      )}
    </MainTemplate>
  );
}

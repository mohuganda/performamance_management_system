import React from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../app/hooks/useTheme';
import { MainTemplate } from '../../components/templates';
import { Card } from '../../components/atoms/Card';
import { Badge } from '../../components/atoms/Badge';
import { useLeaveRequestsQuery, useLeaveTypesQuery } from '../../app/hooks/useLeave';
import { formatDisplayDate, parseISODate } from '../../utils/leavePolicy';
import { LeaveHistoryCard } from '../../components/organisms/leave/LeaveHistoryCard';
import { EmptyState } from '../../components/molecules/EmptyState';
import { Calendar } from 'lucide-react-native';

export function LeaveHistoryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  // Queries
  const { data: requests, isLoading: isRequestsLoading, refetch, isFetching } = useLeaveRequestsQuery();
  const { data: leaveTypes, isLoading: isTypesLoading } = useLeaveTypesQuery();

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

  const isLoading = isRequestsLoading || isTypesLoading;



  return (
    <MainTemplate title={t('leave_history_title')} showBack={true}>
      {isLoading && !isFetching ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={requests}
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
            <View className="py-12">
              <EmptyState
                title={t('leave_history_empty_title', 'No Leave History')}
                description={t('leave_history_empty')}
                icon={<Calendar size={48} color={colors.muted} />}
              />
            </View>
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
              <LeaveHistoryCard
                item={item}
                typeName={typeName}
                displayStart={displayStart}
                displayEnd={displayEnd}
                duration={duration}
              />
            );
          }}
        />
      )}
    </MainTemplate>
  );
}

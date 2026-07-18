import React from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../app/hooks/useTheme';
import { MainTemplate } from '../../components/templates';
import { useLeaveRequestsSync, useLeaveTypesSync } from '../../app/hooks/useLeave';
import { formatDisplayDate, parseISODate } from '../../utils/leavePolicy';
import { LeaveHistoryCard } from '../../components/organisms/leave/LeaveHistoryCard';
import { EmptyState } from '../../components/molecules/EmptyState';
import { Calendar } from 'lucide-react-native';
import withObservables from '@nozbe/with-observables';
import { database } from '../../db';
import LeaveRequestModel from '../../db/models/LeaveRequest';
import LeaveTypeModel from '../../db/models/LeaveTypeModel';

interface LeaveHistoryScreenProps {
  requests: LeaveRequestModel[];
  leaveTypes: LeaveTypeModel[];
}

const BaseLeaveHistoryScreen: React.FC<LeaveHistoryScreenProps> = ({ requests, leaveTypes }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  // Background syncs
  const { isFetching: isRequestsFetching, refetch: refetchRequests } = useLeaveRequestsSync();
  useLeaveTypesSync();

  const handleRefresh = () => {
    refetchRequests();
  };

  const typeMap = React.useMemo(() => {
    const map = new Map<number, string>();
    if (leaveTypes) {
      leaveTypes.forEach((t) => {
        if (t.remoteId) map.set(t.remoteId, t.name);
      });
    }
    return map;
  }, [leaveTypes]);

  return (
    <>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRequestsFetching}
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
          const typeName = typeMap.get(item.leaveTypeId) ?? 'Leave Request';
          const displayStart = item.startDate ? formatDisplayDate(parseISODate(item.startDate)) : '';
          const displayEnd = item.endDate ? formatDisplayDate(parseISODate(item.endDate)) : '';

          // Calculate duration if not provided by backend payload
          let duration = item.daysRequested;
          if (!duration && item.startDate && item.endDate) {
            const start = parseISODate(item.startDate);
            const end = parseISODate(item.endDate);
            if (end >= start) {
              const diffTime = Math.abs(end.getTime() - start.getTime());
              duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            }
          }

          // Map the WatermelonDB model properties back to API-like fields expected by LeaveHistoryCard
          const mappedItem = {
            id: item.remoteId ?? -1, // Fallback to local id for pending_sync
            status: item.status,
            reason: item.reason,
            start_date: item.startDate,
            end_date: item.endDate,
          };

          return (
            <LeaveHistoryCard
              item={mappedItem as any}
              typeName={typeName}
              displayStart={displayStart}
              displayEnd={displayEnd}
              duration={duration ?? undefined}
            />
          );
        }}
      />
    </>
  );
};

const LeaveHistoryDataObserver = withObservables([], () => ({
  requests: database.collections.get<LeaveRequestModel>('leave_requests').query().observe(),
  leaveTypes: database.collections.get<LeaveTypeModel>('leave_types').query().observe(),
}))(BaseLeaveHistoryScreen);

export const LeaveHistoryScreen = () => {
  const { t } = useTranslation();
  return (
    <MainTemplate title={t('leave_history_title')} showBack={true}>
      <LeaveHistoryDataObserver />
    </MainTemplate>
  );
};

import React from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../app/hooks/useTheme';
import { MainTemplate } from '../../components/templates';
import { EmptyState } from '../../components/molecules/EmptyState';
import { useNotificationsInfiniteQuery, useMarkReadMutation, useMarkAllReadMutation } from '../../app/hooks/useNotifications';
import { NotificationCard } from '../../components/organisms/notifications/NotificationCard';
import { Bell } from 'lucide-react-native';
import withObservables from '@nozbe/with-observables';
import { database } from '../../db';
import NotificationModel from '../../db/models/Notification';
import { Q } from '@nozbe/watermelondb';

interface NotificationsScreenProps {
  notifications: NotificationModel[];
}

const BaseNotificationsScreen: React.FC<NotificationsScreenProps> = ({ notifications }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const {
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useNotificationsInfiniteQuery();

  const markReadMutation = useMarkReadMutation();
  const markAllReadMutation = useMarkAllReadMutation();

  const hasUnread = notifications.some(n => !n.isRead);

  const handleRefresh = () => {
    refetch();
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate();
  };

  const renderItem = ({ item }: { item: NotificationModel }) => {
    // Map WatermelonDB Model back to the expected prop structure of NotificationCard
    const mappedItem = {
      id: item.remoteId ?? -1,
      type: item.type as any,
      category: item.category,
      title: item.title,
      message: item.message,
      action_url: item.actionUrl ?? undefined,
      read_at: item.readAt ?? undefined,
      created_at: item.createdAt,
      is_read: item.isRead,
    };

    return (
      <NotificationCard
        item={mappedItem}
        onMarkRead={(id) => markReadMutation.mutate(id)}
      />
    );
  };

  return (
    <View className="flex-1">
      {hasUnread && (
        <View className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-background items-end" style={{ backgroundColor: colors.surface }}>
          <TouchableOpacity onPress={handleMarkAllRead} disabled={markAllReadMutation.isPending}>
            <Text className="text-sm font-bold text-primary">
              {t('notifications_mark_all_read')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isFetchingNextPage}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-4 items-center justify-center">
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View className="py-12">
            <EmptyState
              title={t('notifications_empty_title')}
              description={t('notifications_empty_desc')}
              icon={<Bell size={48} color={colors.muted} />}
            />
          </View>
        }
      />
    </View>
  );
};

const NotificationsDataObserver = withObservables([], () => ({
  notifications: database.collections.get<NotificationModel>('notifications')
    .query(Q.sortBy('server_created_at', Q.desc))
    .observe(),
}))(BaseNotificationsScreen);

export const NotificationsScreen = () => {
  const { t } = useTranslation();
  return (
    <MainTemplate title={t('notifications_title')} showBack={true}>
      <NotificationsDataObserver />
    </MainTemplate>
  );
};

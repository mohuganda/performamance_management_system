import React from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../app/hooks/useTheme';
import { MainTemplate } from '../../components/templates';
import { Card } from '../../components/atoms/Card';
import { EmptyState } from '../../components/molecules/EmptyState';
import { useNotificationsInfiniteQuery, useMarkReadMutation, useMarkAllReadMutation, useUnreadCountQuery } from '../../app/hooks/useNotifications';
import { NotificationRow } from '../../api/notifications/types';
import { NotificationCard } from './components/NotificationCard';
import { Bell } from 'lucide-react-native';

export function NotificationsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const { data: unreadData } = useUnreadCountQuery();
  const hasUnread = (unreadData ?? 0) > 0;

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useNotificationsInfiniteQuery();

  const markReadMutation = useMarkReadMutation();
  const markAllReadMutation = useMarkAllReadMutation();

  const notifications = data?.pages.flatMap((p) => p.data) ?? [];

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

  const renderItem = ({ item }: { item: NotificationRow }) => {
    return (
      <NotificationCard
        item={item}
        onMarkRead={(id) => markReadMutation.mutate(id)}
      />
    );
  };

  return (
    <MainTemplate title={t('notifications_title')} showBack={true}>
      <View className="flex-1">
        {hasUnread && (
          <View className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-background items-end" style={{ backgroundColor: colors.surface }}>
            <TouchableOpacity onPress={handleMarkAllRead} disabled={markAllReadMutation.isPending}>
              <Text className="text-sm font-bold">
                {t('notifications_mark_all_read')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => String(item.id)}
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
        )}
      </View>
    </MainTemplate>
  );
}

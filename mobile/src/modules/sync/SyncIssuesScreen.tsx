import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../app/hooks/useTheme';
import { MainTemplate } from '../../components/templates';
import { useSyncStore } from '../../stores/syncStore';
import { FailedQueuedMutation } from '../../stores/syncStore';
import { showAlert } from '../../stores/alertStore';
import { Trash2, Edit3, AlertTriangle } from 'lucide-react-native';
import { Card } from '../../components/atoms/Card';
import { EmptyState } from '../../components/molecules/EmptyState';

export const SyncIssuesScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  
  const failedQueue = useSyncStore((state) => state.failedQueue);
  const discardFailedMutation = useSyncStore((state) => state.discardFailedMutation);

  const handleDiscard = (id: string) => {
    showAlert({
      type: 'warning',
      title: t('sync_issue_discard_title', 'Discard Request'),
      message: t('sync_issue_discard_desc', 'Are you sure you want to permanently delete this failed request?'),
      cancelText: t('common_cancel', 'Cancel'),
      confirmText: t('common_discard', 'Discard'),
      onConfirm: () => {
        discardFailedMutation(id);
      }
    });
  };

  const handleEdit = (item: FailedQueuedMutation) => {
    // Navigate to respective edit screen based on mutation type
    // We pass the localRecordId so the form can load the optimistic record
    if (item.type === 'LEAVE_REQUEST') {
      navigation.navigate('LeaveRequest', { editMode: true, localRecordId: item.localRecordId, queueId: item.id });
    } else if (item.type === 'OOS_REQUEST') {
      // Need to add edit capability to OutOfStation
      showAlert({
        type: 'info',
        title: 'Not Implemented',
        message: 'Edit for OOS requests coming soon.',
      });
    } else {
      showAlert({
        type: 'error',
        title: 'Cannot Edit',
        message: 'This type of request cannot be edited. Please discard and try again.',
      });
    }
  };

  const renderItem = ({ item }: { item: FailedQueuedMutation }) => {
    return (
      <Card className="mb-3 border-l-4 border-l-red-500">
        <View className="flex-row items-center mb-2">
          <AlertTriangle size={16} color="#ef4444" />
          <Text className="font-bold text-base ml-2 flex-1" style={{ color: colors.text }}>
            {item.type.replace('_', ' ')}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {new Date(item.failedAt).toLocaleDateString()}
          </Text>
        </View>
        
        <View className="bg-red-50 dark:bg-red-900/20 p-2 rounded mb-3">
          <Text className="text-sm text-red-600 dark:text-red-400">
            {item.error || 'Server rejected the request.'}
          </Text>
        </View>

        <View className="flex-row justify-end space-x-4 border-t border-gray-100 dark:border-gray-800 pt-3">
          <TouchableOpacity 
            className="flex-row items-center px-3 py-1.5 border border-red-500 rounded-lg"
            onPress={() => handleDiscard(item.id)}
          >
            <Trash2 size={16} color="#ef4444" />
            <Text className="text-red-500 ml-1.5 font-medium">Discard</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="flex-row items-center px-3 py-1.5 bg-primary rounded-lg"
            onPress={() => handleEdit(item)}
          >
            <Edit3 size={16} color="white" />
            <Text className="text-white ml-1.5 font-medium">Edit</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <MainTemplate title={t('sync_issues_title', 'Failed Requests')} showBack={true}>
      <FlatList
        data={failedQueue}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListEmptyComponent={
          <View className="py-12 mt-10">
            <EmptyState
              title={t('sync_issues_empty_title', 'All Good!')}
              description={t('sync_issues_empty_desc', 'There are no failed requests. Everything is in sync.')}
            />
          </View>
        }
      />
    </MainTemplate>
  );
};

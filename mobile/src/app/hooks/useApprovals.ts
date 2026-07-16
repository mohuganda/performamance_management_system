import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import approvalsService from '../../api/approvals/service';
import {
  ApprovalInboxItem,
  ApprovalsInboxResponse,
  ApprovalInboxStats,
} from '../../api/approvals/types';
import { useSyncStore } from '../../stores/syncStore';

export function useApprovalsInboxQuery() {
  const queue = useSyncStore((state) => state.queue);

  const queryResult = useQuery<ApprovalsInboxResponse, Error>({
    queryKey: ['approvals', 'inbox'],
    queryFn: async () => {
      return await approvalsService.inbox();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  const mergedData = useMemo(() => {
    if (!queryResult.data) return queryResult.data;

    // Find any approval actions in the sync queue
    const queuedApprovalIds = queue
      .filter((mut) => mut.type === 'APPROVAL_ACTION')
      .map((mut) => mut.payload?.original_item_id as string)
      .filter(Boolean);

    // Filter out items that have a pending action in the offline queue
    const updatedPending = queryResult.data.pending.filter(
      (item) => !queuedApprovalIds.includes(item.id)
    );

    // Recalculate stats based on removed items
    const removedItems = queryResult.data.pending.filter(
      (item) => queuedApprovalIds.includes(item.id)
    );

    const stats: ApprovalInboxStats = { ...queryResult.data.stats };
    
    for (const item of removedItems) {
      stats.pending_total--;
      if (item.module === 'leave') stats.leave_pending--;
      if (item.module === 'oos') stats.oos_pending--;
      if (item.module === 'performance') stats.performance_pending--;
      if (item.module === 'ppa') stats.ppa_pending--;
    }

    return {
      ...queryResult.data,
      stats,
      pending: updatedPending,
    };
  }, [queryResult.data, queue]);

  return {
    ...queryResult,
    data: mergedData,
  };
}

export function useActApprovalMutation() {
  const queryClient = useQueryClient();
  const addMutation = useSyncStore((state) => state.addMutation);

  return useMutation<
    any | null,
    Error,
    { item: ApprovalInboxItem; approve: boolean; comments?: string; isOfflineOverride?: boolean }
  >({
    mutationFn: async ({ item, approve, comments, isOfflineOverride }) => {
      const netInfo = await NetInfo.fetch();
      const isOffline = isOfflineOverride || !netInfo.isConnected || !netInfo.isInternetReachable;

      let endpoint = '';
      let payload: any = {};

      const note = comments?.trim() ?? '';

      if (item.module === 'leave' && item.approval_id) {
        endpoint = `/mobile/leave/approvals/${item.approval_id}`;
        payload = { approve, comments: note };
      } else if (item.module === 'oos' && item.approval_id) {
        endpoint = `/mobile/out-of-station/approvals/${item.approval_id}`;
        payload = { approve, comments: note };
      } else if (item.module === 'ppa' && item.ppa_id) {
        endpoint = `/mobile/performance/ppa/review`;
        payload = { ppa_id: item.ppa_id, approve, comments: note };
      } else if (item.module === 'performance' && item.report_id) {
        endpoint = `/mobile/performance/appraisal/review`;
        payload = {
          report_id: item.report_id,
          decision: approve ? 'approve' : 'return',
          comments: note || (approve ? 'Approved' : 'Returned for revision'),
          comment_role:
            item.status === 'countersigning'
              ? 'countersigning'
              : item.status === 'responsible_review'
              ? 'responsible_officer'
              : 'appraiser',
        };
      } else {
        throw new Error('Unsupported approval item');
      }

      if (isOffline) {
        addMutation({
          type: 'APPROVAL_ACTION',
          endpoint,
          payload: { ...payload, original_item_id: item.id },
        });
        return { offline: true };
      }

      // If online, use specific service method
      if (item.module === 'leave') {
        return await approvalsService.approveLeave(item.approval_id!, payload);
      } else if (item.module === 'oos') {
        return await approvalsService.approveOos(item.approval_id!, payload);
      } else if (item.module === 'ppa') {
        return await approvalsService.reviewPpa(payload);
      } else if (item.module === 'performance') {
        return await approvalsService.reviewAppraisal(payload);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      // Invalidate relevant modules so their lists refresh
      queryClient.invalidateQueries({ queryKey: ['leave'] });
      queryClient.invalidateQueries({ queryKey: ['oos'] });
      queryClient.invalidateQueries({ queryKey: ['performance'] });
    },
  });
}

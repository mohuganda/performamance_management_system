import { useMemo, useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import approvalsService from '../../api/approvals/service';
import {
  ApprovalInboxItem,
  ApprovalsInboxResponse,
  ApprovalInboxStats,
} from '../../api/approvals/types';
import { useSyncStore } from '../../stores/syncStore';
import { ApprovalsDbService } from '../../db/services/ApprovalsDbService';

export function useApprovalsInboxSync() {
  const queue = useSyncStore((state) => state.queue);

  return useQuery({
    queryKey: ['approvals', 'inbox_sync'],
    queryFn: async () => {
      const data = await approvalsService.inbox();
      
      const queuedApprovalIds = queue
        .filter((mut) => mut.type === 'APPROVAL_ACTION')
        .map((mut) => mut.payload?.original_item_id as string)
        .filter(Boolean);
        
      await ApprovalsDbService.saveStats(data.stats);
      await ApprovalsDbService.syncInbox(data.pending, queuedApprovalIds);
      
      return data;
    },
  });
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
        await ApprovalsDbService.removeOptimisticTask(item.id);
        return { offline: true };
      }

      // If online, use specific service method
      let result;
      if (item.module === 'leave') {
        result = await approvalsService.approveLeave(item.approval_id!, payload);
      } else if (item.module === 'oos') {
        result = await approvalsService.approveOos(item.approval_id!, payload);
      } else if (item.module === 'ppa') {
        result = await approvalsService.reviewPpa(payload);
      } else if (item.module === 'performance') {
        result = await approvalsService.reviewAppraisal(payload);
      }
      
      // On success locally remove it right away for snappiness
      await ApprovalsDbService.removeOptimisticTask(item.id);
      
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['approvals', 'inbox_sync'] });
      // Invalidate relevant modules so their lists refresh
      queryClient.invalidateQueries({ queryKey: ['leave'] });
      queryClient.invalidateQueries({ queryKey: ['oos'] });
      queryClient.invalidateQueries({ queryKey: ['performance'] });
    },
  });
}

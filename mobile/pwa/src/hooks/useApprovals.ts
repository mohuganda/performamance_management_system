import { useMutation, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import approvalsService from '../api/approvals/service';
import {
  ApprovalInboxItem,
  ApprovalsInboxResponse,
  ApproveLeavePayload,
  ApproveOosPayload,
  ReviewAppraisalPayload,
  ReviewPpaPayload,
} from '../api/approvals/types';
import { useSyncStore } from '../stores/syncStore';
import { useAuthStore } from '../stores/authStore';
import { getUserCache, setUserCache } from '../utils/userCache';

export const APPROVALS_QUERY_KEYS = {
  all: ['approvals'] as const,
  inbox: (userId?: number | string | null) =>
    [...APPROVALS_QUERY_KEYS.all, userId ?? 'anonymous', 'inbox'] as const,
};

export function useApprovalsInboxQuery(enabled = true): UseQueryResult<ApprovalsInboxResponse, Error> {
  const userId = useAuthStore((s) => s.user?.id || s.staffId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: APPROVALS_QUERY_KEYS.inbox(userId),
    queryFn: async () => {
      const res = await approvalsService.inbox();
      if (res && userId) {
        setUserCache('approvals-inbox', userId, res);
        if (res.stats) {
          setUserCache('approvals-stats', userId, res.stats);
        }
      }
      return res;
    },
    initialData: () => {
      if (!userId) return undefined;
      return getUserCache<ApprovalsInboxResponse>('approvals-inbox', userId);
    },
    enabled: Boolean(enabled && isAuthenticated && userId),
    staleTime: 60 * 1000,
  });
}

export interface ActApprovalParams {
  item: ApprovalInboxItem;
  approve: boolean;
  comments?: string;
}

export function useActApprovalMutation() {
  const queryClient = useQueryClient();
  const addMutation = useSyncStore((state) => state.addMutation);
  const userId = useAuthStore((state) => state.user?.id || state.staffId);

  return useMutation<any, Error, ActApprovalParams>({
    mutationFn: async ({ item, approve, comments }) => {
      const note = comments?.trim() || undefined;

      let endpoint = '';
      let payload: any = {};

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
        throw new Error('Unsupported approval module');
      }

      if (!navigator.onLine) {
        addMutation({
          userId,
          type: 'APPROVAL_ACTION',
          endpoint,
          method: 'POST',
          payload,
        });

        // Optimistically remove from inbox cache
        queryClient.setQueryData<ApprovalsInboxResponse>(APPROVALS_QUERY_KEYS.inbox(userId), (old) => {
          if (!old) return old;
          return {
            ...old,
            pending: old.pending.filter((t) => t.id !== item.id),
            stats: {
              ...old.stats,
              pending_total: Math.max(0, old.stats.pending_total - 1),
            },
          };
        });

        return { offline: true };
      }

      // Online service execution
      let result;
      if (item.module === 'leave' && item.approval_id) {
        result = await approvalsService.approveLeave(item.approval_id, payload);
      } else if (item.module === 'oos' && item.approval_id) {
        result = await approvalsService.approveOos(item.approval_id, payload);
      } else if (item.module === 'ppa') {
        result = await approvalsService.reviewPpa(payload);
      } else if (item.module === 'performance') {
        result = await approvalsService.reviewAppraisal(payload);
      }

      // Optimistically remove from inbox cache
      queryClient.setQueryData<ApprovalsInboxResponse>(APPROVALS_QUERY_KEYS.inbox(userId), (old) => {
        if (!old) return old;
        return {
          ...old,
          pending: old.pending.filter((t) => t.id !== item.id),
          stats: {
            ...old.stats,
            pending_total: Math.max(0, old.stats.pending_total - 1),
          },
        };
      });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPROVALS_QUERY_KEYS.all });
    },
  });
}

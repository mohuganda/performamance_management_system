import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export const APPROVALS_QUERY_KEYS = {
  all: ['approvals'] as const,
  inbox: () => [...APPROVALS_QUERY_KEYS.all, 'inbox'] as const,
};

export function useApprovalsInboxQuery(enabled = true) {
  return useQuery<ApprovalsInboxResponse, Error>({
    queryKey: APPROVALS_QUERY_KEYS.inbox(),
    queryFn: async () => {
      const res = await approvalsService.inbox();
      if (res) {
        localStorage.setItem('moh-pms-approvals-inbox', JSON.stringify(res));
        if (res.stats) {
          localStorage.setItem('moh-pms-approvals-stats', JSON.stringify(res.stats));
        }
      }
      return res;
    },
    initialData: () => {
      try {
        const cached = localStorage.getItem('moh-pms-approvals-inbox');
        return cached ? JSON.parse(cached) : undefined;
      } catch {
        return undefined;
      }
    },
    enabled,
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
          type: 'APPROVAL_ACTION',
          endpoint,
          method: 'POST',
          payload,
        });

        // Optimistically remove from inbox cache
        queryClient.setQueryData<ApprovalsInboxResponse>(APPROVALS_QUERY_KEYS.inbox(), (old) => {
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
      queryClient.setQueryData<ApprovalsInboxResponse>(APPROVALS_QUERY_KEYS.inbox(), (old) => {
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

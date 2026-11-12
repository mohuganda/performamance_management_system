import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import oosService from '../api/oos/service';
import {
  OosReason,
  OosRequest,
  OosSubmissionPayload,
  OosApproval,
} from '../api/oos/types';
import { useSyncStore } from '../stores/syncStore';

export const OOS_QUERY_KEYS = {
  all: ['oos'] as const,
  reasons: () => [...OOS_QUERY_KEYS.all, 'reasons'] as const,
  requests: () => [...OOS_QUERY_KEYS.all, 'requests'] as const,
  pendingApprovals: () => [...OOS_QUERY_KEYS.all, 'pending-approvals'] as const,
};

export function useOosReasonsQuery() {
  return useQuery<OosReason[], Error>({
    queryKey: OOS_QUERY_KEYS.reasons(),
    queryFn: async () => {
      const data = await oosService.listReasons();
      if (data && data.length > 0) {
        localStorage.setItem('moh-pms-oos-reasons', JSON.stringify(data));
      }
      return data;
    },
    initialData: () => {
      try {
        const cached = localStorage.getItem('moh-pms-oos-reasons');
        return cached ? JSON.parse(cached) : undefined;
      } catch {
        return undefined;
      }
    },
    staleTime: 15 * 60 * 1000,
  });
}

export function useOosRequestsQuery() {
  return useQuery<OosRequest[], Error>({
    queryKey: OOS_QUERY_KEYS.requests(),
    queryFn: async () => {
      const data = await oosService.listRequests();
      if (data) {
        localStorage.setItem('moh-pms-oos-requests', JSON.stringify(data));
      }
      return data;
    },
    initialData: () => {
      try {
        const cached = localStorage.getItem('moh-pms-oos-requests');
        return cached ? JSON.parse(cached) : undefined;
      } catch {
        return undefined;
      }
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useOosPendingApprovalsQuery() {
  return useQuery<OosApproval[], Error>({
    queryKey: OOS_QUERY_KEYS.pendingApprovals(),
    queryFn: async () => {
      return await oosService.listPendingApprovals();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateOosMutation() {
  const queryClient = useQueryClient();
  const addMutation = useSyncStore((state) => state.addMutation);

  return useMutation<any, Error, OosSubmissionPayload>({
    mutationFn: async (payload: OosSubmissionPayload) => {
      if (!navigator.onLine) {
        addMutation({
          type: 'OOS_REQUEST',
          endpoint: '/mobile/out-of-station/requests',
          method: 'POST',
          payload,
        });
        return { offline: true };
      }

      return await oosService.createRequest(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OOS_QUERY_KEYS.requests() });
    },
  });
}

export function useApproveOosMutation() {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { id: number; approve: boolean; comments?: string }>({
    mutationFn: async ({ id, approve, comments }) => {
      return await oosService.approve(id, { approve, comments });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OOS_QUERY_KEYS.all });
    },
  });
}

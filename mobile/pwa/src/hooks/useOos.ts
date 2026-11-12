import { useMutation, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import oosService from '../api/oos/service';
import {
  OosReason,
  OosRequest,
  OosSubmissionPayload,
  OosApproval,
} from '../api/oos/types';
import { useSyncStore } from '../stores/syncStore';
import { useAuthStore } from '../stores/authStore';
import { getUserCache, setUserCache } from '../utils/userCache';

export const OOS_QUERY_KEYS = {
  all: ['oos'] as const,
  reasons: () => [...OOS_QUERY_KEYS.all, 'reasons'] as const,
  requests: (userId?: number | string | null) =>
    [...OOS_QUERY_KEYS.all, userId ?? 'anonymous', 'requests'] as const,
  pendingApprovals: (userId?: number | string | null) =>
    [...OOS_QUERY_KEYS.all, userId ?? 'anonymous', 'pending-approvals'] as const,
};

export function useOosReasonsQuery(): UseQueryResult<OosReason[], Error> {
  const userId = useAuthStore((s) => s.user?.id || s.staffId);

  return useQuery({
    queryKey: OOS_QUERY_KEYS.reasons(),
    queryFn: async () => {
      const data = await oosService.listReasons();
      if (data && data.length > 0 && userId) {
        setUserCache('oos-reasons', userId, data);
      }
      return data;
    },
    initialData: () => {
      if (!userId) return undefined;
      return getUserCache<OosReason[]>('oos-reasons', userId);
    },
    staleTime: 15 * 60 * 1000,
  });
}

export function useOosRequestsQuery(): UseQueryResult<OosRequest[], Error> {
  const userId = useAuthStore((s) => s.user?.id || s.staffId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: OOS_QUERY_KEYS.requests(userId),
    queryFn: async () => {
      const data = await oosService.listRequests();
      if (data && userId) {
        setUserCache('oos-requests', userId, data);
      }
      return data;
    },
    initialData: () => {
      if (!userId) return undefined;
      return getUserCache<OosRequest[]>('oos-requests', userId);
    },
    enabled: Boolean(isAuthenticated && userId),
    staleTime: 2 * 60 * 1000,
  });
}

export function useOosPendingApprovalsQuery() {
  const userId = useAuthStore((s) => s.user?.id || s.staffId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery<OosApproval[], Error>({
    queryKey: OOS_QUERY_KEYS.pendingApprovals(userId),
    queryFn: async () => {
      return await oosService.listPendingApprovals();
    },
    enabled: Boolean(isAuthenticated && userId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateOosMutation() {
  const queryClient = useQueryClient();
  const addMutation = useSyncStore((state) => state.addMutation);
  const userId = useAuthStore((state) => state.user?.id || state.staffId);

  return useMutation<any, Error, OosSubmissionPayload>({
    mutationFn: async (payload: OosSubmissionPayload) => {
      if (!navigator.onLine) {
        addMutation({
          userId,
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
      queryClient.invalidateQueries({ queryKey: OOS_QUERY_KEYS.all });
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

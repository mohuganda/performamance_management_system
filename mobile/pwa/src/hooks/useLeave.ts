import { useMutation, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { leaveService } from '../api/leave/service';
import {
  LeavePolicyConfig,
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  LeaveSubmissionPayload,
} from '../api/leave/types';
import { useSyncStore } from '../stores/syncStore';
import { useAuthStore } from '../stores/authStore';
import { getUserCache, setUserCache } from '../utils/userCache';

export const LEAVE_QUERY_KEYS = {
  all: ['leave'] as const,
  config: () => [...LEAVE_QUERY_KEYS.all, 'config'] as const,
  types: () => [...LEAVE_QUERY_KEYS.all, 'types'] as const,
  balances: (userId?: number | string | null, year?: number) =>
    [...LEAVE_QUERY_KEYS.all, userId ?? 'anonymous', 'balances', year] as const,
  requests: (userId?: number | string | null) =>
    [...LEAVE_QUERY_KEYS.all, userId ?? 'anonymous', 'requests'] as const,
};

export function useLeaveConfigQuery() {
  return useQuery<LeavePolicyConfig, Error>({
    queryKey: LEAVE_QUERY_KEYS.config(),
    queryFn: async () => {
      return await leaveService.getConfig();
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useLeaveTypesQuery(): UseQueryResult<LeaveType[], Error> {
  const userId = useAuthStore((s) => s.user?.id || s.staffId);
  return useQuery({
    queryKey: LEAVE_QUERY_KEYS.types(),
    queryFn: async () => {
      const types = await leaveService.listTypes();
      if (types && types.length > 0 && userId) {
        setUserCache('leave-types', userId, types);
      }
      return types;
    },
    initialData: () => {
      if (!userId) return undefined;
      return getUserCache<LeaveType[]>('leave-types', userId);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useLeaveBalancesQuery(year?: number): UseQueryResult<LeaveBalance[], Error> {
  const userId = useAuthStore((s) => s.user?.id || s.staffId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: LEAVE_QUERY_KEYS.balances(userId, year),
    queryFn: async () => {
      const balances = await leaveService.listBalances(year);
      if (balances && balances.length > 0 && userId) {
        setUserCache('leave-balances', userId, balances);
      }
      return balances;
    },
    initialData: () => {
      if (!userId) return undefined;
      return getUserCache<LeaveBalance[]>('leave-balances', userId);
    },
    enabled: Boolean(isAuthenticated && userId),
    staleTime: 2 * 60 * 1000,
  });
}

export function useLeaveRequestsQuery(): UseQueryResult<LeaveRequest[], Error> {
  const userId = useAuthStore((s) => s.user?.id || s.staffId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: LEAVE_QUERY_KEYS.requests(userId),
    queryFn: async () => {
      const requests = await leaveService.listRequests();
      if (requests && userId) {
        setUserCache('leave-requests', userId, requests);
      }
      return requests;
    },
    initialData: () => {
      if (!userId) return undefined;
      return getUserCache<LeaveRequest[]>('leave-requests', userId);
    },
    enabled: Boolean(isAuthenticated && userId),
    staleTime: 1 * 60 * 1000,
  });
}

export function useCreateLeaveMutation() {
  const queryClient = useQueryClient();
  const addMutation = useSyncStore((state) => state.addMutation);
  const userId = useAuthStore((state) => state.user?.id || state.staffId);

  return useMutation<any, Error, LeaveSubmissionPayload>({
    mutationFn: async (payload: LeaveSubmissionPayload) => {
      if (!navigator.onLine) {
        addMutation({
          userId,
          type: 'LEAVE_REQUEST',
          endpoint: '/mobile/leave/requests',
          method: 'POST',
          payload,
        });
        return { offline: true };
      }

      return await leaveService.createRequest(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEAVE_QUERY_KEYS.all });
    },
  });
}

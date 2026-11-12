import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leaveService } from '../api/leave/service';
import {
  LeavePolicyConfig,
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  LeaveSubmissionPayload,
} from '../api/leave/types';
import { useSyncStore } from '../stores/syncStore';

export const LEAVE_QUERY_KEYS = {
  all: ['leave'] as const,
  config: () => [...LEAVE_QUERY_KEYS.all, 'config'] as const,
  types: () => [...LEAVE_QUERY_KEYS.all, 'types'] as const,
  balances: (year?: number) => [...LEAVE_QUERY_KEYS.all, 'balances', year] as const,
  requests: () => [...LEAVE_QUERY_KEYS.all, 'requests'] as const,
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

export function useLeaveTypesQuery() {
  return useQuery<LeaveType[], Error>({
    queryKey: LEAVE_QUERY_KEYS.types(),
    queryFn: async () => {
      const types = await leaveService.listTypes();
      if (types && types.length > 0) {
        localStorage.setItem('moh-pms-leave-types', JSON.stringify(types));
      }
      return types;
    },
    initialData: () => {
      try {
        const cached = localStorage.getItem('moh-pms-leave-types');
        return cached ? JSON.parse(cached) : undefined;
      } catch {
        return undefined;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useLeaveBalancesQuery(year?: number) {
  return useQuery<LeaveBalance[], Error>({
    queryKey: LEAVE_QUERY_KEYS.balances(year),
    queryFn: async () => {
      const balances = await leaveService.listBalances(year);
      if (balances && balances.length > 0) {
        localStorage.setItem('moh-pms-leave-balances', JSON.stringify(balances));
      }
      return balances;
    },
    initialData: () => {
      try {
        const cached = localStorage.getItem('moh-pms-leave-balances');
        return cached ? JSON.parse(cached) : undefined;
      } catch {
        return undefined;
      }
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useLeaveRequestsQuery() {
  return useQuery<LeaveRequest[], Error>({
    queryKey: LEAVE_QUERY_KEYS.requests(),
    queryFn: async () => {
      const requests = await leaveService.listRequests();
      if (requests) {
        localStorage.setItem('moh-pms-leave-requests', JSON.stringify(requests));
      }
      return requests;
    },
    initialData: () => {
      try {
        const cached = localStorage.getItem('moh-pms-leave-requests');
        return cached ? JSON.parse(cached) : undefined;
      } catch {
        return undefined;
      }
    },
    staleTime: 1 * 60 * 1000,
  });
}

export function useCreateLeaveMutation() {
  const queryClient = useQueryClient();
  const addMutation = useSyncStore((state) => state.addMutation);

  return useMutation<any, Error, LeaveSubmissionPayload>({
    mutationFn: async (payload: LeaveSubmissionPayload) => {
      if (!navigator.onLine) {
        addMutation({
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

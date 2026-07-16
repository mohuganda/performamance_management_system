import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import leaveService from '../../api/leave/service';
import {
  LeavePolicyConfig,
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  LeaveSubmissionPayload,
} from '../../api/leave/types';
import { useSyncStore } from '../../stores/syncStore';

export function useLeaveConfigQuery() {
  return useQuery<LeavePolicyConfig, Error>({
    queryKey: ['leave', 'config'],
    queryFn: async () => {
      return await leaveService.getConfig();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes cache
  });
}

export function useLeaveTypesQuery() {
  return useQuery<LeaveType[], Error>({
    queryKey: ['leave', 'types'],
    queryFn: async () => {
      return await leaveService.listTypes();
    },
    staleTime: 15 * 60 * 1000, // 15 minutes cache
  });
}

export function useLeaveBalancesQuery(year?: number) {
  return useQuery<LeaveBalance[], Error>({
    queryKey: ['leave', 'balances', year],
    queryFn: async () => {
      return await leaveService.listBalances(year);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
}

export function useLeaveRequestsQuery() {
  const queue = useSyncStore((state) => state.queue);

  const queryResult = useQuery<LeaveRequest[], Error>({
    queryKey: ['leave', 'requests'],
    queryFn: async () => {
      return await leaveService.listRequests();
    },
    staleTime: 5 * 60 * 1000,
  });

  const mergedData = useMemo(() => {
    if (!queryResult.data) return queryResult.data;

    const queuedRequests = queue
      .filter((mut) => mut.type === 'LEAVE_REQUEST')
      .map((mut, index) => {
        const payload = mut.payload as LeaveSubmissionPayload;
        return {
          id: -Number(mut.id.replace(/\D/g, '').substring(0, 6)) || -(index + 1),
          leave_type_id: Number(payload.leave_type_id),
          start_date: payload.start_date,
          end_date: payload.end_date,
          status: 'pending_sync' as const,
          reason: payload.reason,
          days_requested: undefined,
        } as LeaveRequest;
      });

    return [...queuedRequests, ...queryResult.data];
  }, [queryResult.data, queue]);

  return {
    ...queryResult,
    data: mergedData,
  };
}

export function useCreateLeaveMutation() {
  const queryClient = useQueryClient();
  const addMutation = useSyncStore((state) => state.addMutation);

  return useMutation<any | null, Error, LeaveSubmissionPayload & { isOfflineOverride?: boolean }>({
    mutationFn: async (payload) => {
      const { isOfflineOverride, ...cleanPayload } = payload;

      const netInfo = await NetInfo.fetch();
      const isOffline = isOfflineOverride || !netInfo.isConnected || !netInfo.isInternetReachable;

      if (isOffline) {
        addMutation({
          type: 'LEAVE_REQUEST',
          endpoint: '/mobile/leave/requests',
          payload: cleanPayload,
        });
        return { offline: true };
      }

      return await leaveService.createRequest(cleanPayload);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leave'] });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import leaveService from '../../api/leave/service';
import {
  LeavePolicyConfig,
  LeaveSubmissionPayload,
} from '../../api/leave/types';
import { useSyncStore } from '../../stores/syncStore';
import { LeaveDbService } from '../../db/services/LeaveDbService';

export function useLeaveConfigQuery() {
  return useQuery<LeavePolicyConfig, Error>({
    queryKey: ['leave', 'config'],
    queryFn: async () => {
      return await leaveService.getConfig();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes cache
  });
}

export function useLeaveTypesSync() {
  return useQuery({
    queryKey: ['leave', 'types_sync'],
    queryFn: async () => {
      const types = await leaveService.listTypes();
      await LeaveDbService.syncLeaveTypes(types);
      return types;
    },
  });
}

export function useLeaveBalancesSync(year?: number) {
  return useQuery({
    queryKey: ['leave', 'balances_sync', year],
    queryFn: async () => {
      const balances = await leaveService.listBalances(year);
      await LeaveDbService.syncLeaveBalances(balances);
      return balances;
    },
  });
}

export function useLeaveRequestsSync() {
  return useQuery({
    queryKey: ['leave', 'requests_sync'],
    queryFn: async () => {
      const requests = await leaveService.listRequests();
      await LeaveDbService.syncLeaveRequests(requests);
      return requests;
    },
  });
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
        const newRequest = await LeaveDbService.addOptimisticRequest(cleanPayload);
        addMutation({
          type: 'LEAVE_REQUEST',
          endpoint: '/mobile/leave/requests',
          payload: cleanPayload,
          localRecordId: newRequest.id,
          modelTable: 'leave_requests',
        });
        return { offline: true };
      }

      return await leaveService.createRequest(cleanPayload);
    },
    onSuccess: (data) => {
      // Re-trigger sync
      queryClient.invalidateQueries({ queryKey: ['leave'] });
    },
  });
}

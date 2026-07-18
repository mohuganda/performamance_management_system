import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import oosService from '../../api/out-of-station/service';
import {
  OosReason,
  OosSubmissionPayload,
  OosApproval,
} from '../../api/out-of-station/types';
import { useSyncStore } from '../../stores/syncStore';
import { OosDbService } from '../../db/services/OosDbService';

export function useOosReasonsQuery() {
  return useQuery<OosReason[], Error>({
    queryKey: ['oos', 'reasons'],
    queryFn: async () => {
      return await oosService.listReasons();
    },
    staleTime: 15 * 60 * 1000, // 15 minutes cache
  });
}

export function useOosRequestsSync() {
  return useQuery({
    queryKey: ['oos', 'requests_sync'],
    queryFn: async () => {
      const data = await oosService.listRequests();
      await OosDbService.syncRequests(data);
      return data;
    },
  });
}

export function useOosPendingApprovalsQuery() {
  return useQuery<OosApproval[], Error>({
    queryKey: ['oos', 'pending-approvals'],
    queryFn: async () => {
      return await oosService.listPendingApprovals();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
}

export function useCreateOosMutation() {
  const queryClient = useQueryClient();
  const addMutation = useSyncStore((state) => state.addMutation);

  return useMutation<any | null, Error, OosSubmissionPayload & { isOfflineOverride?: boolean }>({
    mutationFn: async (payload) => {
      const { isOfflineOverride, ...cleanPayload } = payload;

      const netInfo = await NetInfo.fetch();
      const isOffline = isOfflineOverride || !netInfo.isConnected || !netInfo.isInternetReachable;

      if (isOffline) {
        const newRequest = await OosDbService.addOptimisticRequest(cleanPayload);
        addMutation({
          type: 'OOS_REQUEST',
          endpoint: '/mobile/out-of-station/requests',
          payload: cleanPayload,
          localRecordId: newRequest.id,
          modelTable: 'oos_requests',
        });
        return { offline: true };
      }

      return await oosService.createRequest(cleanPayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oos', 'requests_sync'] });
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
      queryClient.invalidateQueries({ queryKey: ['oos'] });
    },
  });
}

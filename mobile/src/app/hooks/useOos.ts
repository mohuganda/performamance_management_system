import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import oosService from '../../api/out-of-station/service';
import {
  OosReason,
  OosRequest,
  OosSubmissionPayload,
  OosApproval,
} from '../../api/out-of-station/types';
import { useSyncStore } from '../../stores/syncStore';

export function useOosReasonsQuery() {
  return useQuery<OosReason[], Error>({
    queryKey: ['oos', 'reasons'],
    queryFn: async () => {
      return await oosService.listReasons();
    },
    staleTime: 15 * 60 * 1000, // 15 minutes cache
  });
}

export function useOosRequestsQuery() {
  const queue = useSyncStore((state) => state.queue);

  const queryResult = useQuery<OosRequest[], Error>({
    queryKey: ['oos', 'requests'],
    queryFn: async () => {
      return await oosService.listRequests();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  const mergedData = useMemo(() => {
    if (!queryResult.data) return queryResult.data;

    // Optimistic previews: extract and format unsynced items from sync queue
    const queuedRequests = queue
      .filter((mut) => mut.type === 'OOS_REQUEST')
      .map((mut, index) => {
        const payload = mut.payload as OosSubmissionPayload;
        return {
          id: -Number(mut.id.replace(/\D/g, '').substring(0, 6)) || -(index + 1),
          reason_id: Number(payload.reason_id),
          start_date: payload.start_date,
          end_date: payload.end_date,
          remarks: payload.remarks,
          expected_deliverables: payload.expected_deliverables,
          attachment_url: payload.attachment_url,
          destination_name: payload.destination_name,
          destination_address: payload.destination_address,
          destination_latitude: payload.destination_latitude,
          destination_longitude: payload.destination_longitude,
          geofence_radius_meters: payload.geofence_radius_meters ?? 500,
          status: 'pending_sync' as const,
        } as OosRequest;
      });

    return [...queuedRequests, ...queryResult.data];
  }, [queryResult.data, queue]);

  return {
    ...queryResult,
    data: mergedData,
  };
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
        addMutation({
          type: 'OOS_REQUEST',
          endpoint: '/mobile/out-of-station/requests',
          payload: cleanPayload,
        });
        return { offline: true };
      }

      return await oosService.createRequest(cleanPayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oos'] });
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

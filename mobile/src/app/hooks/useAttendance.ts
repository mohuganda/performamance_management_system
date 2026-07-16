import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import attendanceService from '../../api/attendance/service';
import { ClockRequest, ClockResponse, ClockListParams } from '../../api/attendance/types';
import { useSyncStore } from '../../stores/syncStore';

export function useAttendanceListQuery(params?: ClockListParams) {
  const queue = useSyncStore((state) => state.queue);

  const queryResult = useQuery<ClockResponse[], Error>({
    queryKey: ['attendance', 'clocks', params],
    queryFn: async () => {
      return await attendanceService.listClocks(params);
    },
    staleTime: 5 * 60 * 1000,
  });

  const mergedData = useMemo(() => {
    if (!queryResult.data) return queryResult.data;

    const queuedClocks = queue
      .filter((mut) => mut.type === 'CLOCK')
      .map((mut, index) => {
        const payload = mut.payload as ClockRequest;
        return {
          id: -Number(mut.id.replace(/\D/g, '').substring(0, 6)) || -(index + 1),
          action: payload.action,
          clocked_at: payload.clocked_at || new Date().toISOString(),
          latitude: payload.latitude,
          longitude: payload.longitude,
          verified: false,
          within_geofence: false,
          notes: payload.notes,
          isOfflinePending: true,
        } as unknown as ClockResponse;
      });

    return [...queuedClocks, ...queryResult.data];
  }, [queryResult.data, queue]);

  return {
    ...queryResult,
    data: mergedData,
  };
}

export function useClockMutation() {
  const queryClient = useQueryClient();
  const addMutation = useSyncStore((state) => state.addMutation);

  return useMutation<ClockResponse | null, Error, ClockRequest & { isOfflineOverride?: boolean }>({
    mutationFn: async (payload) => {
      const { isOfflineOverride, ...cleanPayload } = payload;
      
      // Ensure client-side timestamp is captured at the moment of the action
      if (!cleanPayload.clocked_at) {
        cleanPayload.clocked_at = new Date().toISOString();
      }
      
      const netInfo = await NetInfo.fetch();
      const isOffline = isOfflineOverride || !netInfo.isConnected || !netInfo.isInternetReachable;

      if (isOffline) {
        addMutation({
          type: 'CLOCK',
          endpoint: '/mobile/attendance/clock',
          payload: cleanPayload,
        });
        return null;
      }

      return await attendanceService.clock(cleanPayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'clocks'] });
    },
  });
}

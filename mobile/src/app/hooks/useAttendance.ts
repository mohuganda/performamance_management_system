import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import attendanceService from '../../api/attendance/service';
import { ClockRequest, ClockResponse, ClockListParams } from '../../api/attendance/types';
import { useSyncStore } from '../../stores/syncStore';

export function useAttendanceListQuery(params?: ClockListParams) {
  return useQuery<ClockResponse[], Error>({
    queryKey: ['attendance', 'clocks', params],
    queryFn: async () => {
      return await attendanceService.listClocks(params);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useClockMutation() {
  const queryClient = useQueryClient();
  const addMutation = useSyncStore((state) => state.addMutation);

  return useMutation<ClockResponse | null, Error, ClockRequest & { isOfflineOverride?: boolean }>({
    mutationFn: async (payload) => {
      const { isOfflineOverride, ...cleanPayload } = payload;
      
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

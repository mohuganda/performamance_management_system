import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import attendanceService from '../../api/attendance/service';
import { ClockRequest, ClockResponse, ClockListParams } from '../../api/attendance/types';
import { useSyncStore } from '../../stores/syncStore';
import { AttendanceDbService } from '../../db/services/AttendanceDbService';

export function useAttendanceListSync(params?: ClockListParams) {
  return useQuery({
    queryKey: ['attendance', 'clocks_sync', params],
    queryFn: async () => {
      const clocks = await attendanceService.listClocks(params);
      await AttendanceDbService.syncClocks(clocks);
      return clocks;
    },
  });
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
        await AttendanceDbService.addOptimisticClock(cleanPayload);
        return null;
      }

      return await attendanceService.clock(cleanPayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'clocks_sync'] });
    },
  });
}

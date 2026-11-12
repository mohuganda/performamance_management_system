import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import attendanceService from '../api/attendance/service';
import { ClockRequest, ClockResponse, ClockListParams } from '../api/attendance/types';
import { useSyncStore } from '../stores/syncStore';

export const ATTENDANCE_QUERY_KEYS = {
  all: ['attendance'] as const,
  clocks: (params?: ClockListParams) => [...ATTENDANCE_QUERY_KEYS.all, 'clocks', params] as const,
};

export function useAttendanceListQuery(params?: ClockListParams) {
  return useQuery<ClockResponse[], Error>({
    queryKey: ATTENDANCE_QUERY_KEYS.clocks(params),
    queryFn: async () => {
      const clocks = await attendanceService.listClocks(params);
      if (clocks) {
        localStorage.setItem('moh-pms-attendance-cache', JSON.stringify(clocks));
      }
      return clocks;
    },
    initialData: () => {
      try {
        const cached = localStorage.getItem('moh-pms-attendance-cache');
        return cached ? JSON.parse(cached) : undefined;
      } catch {
        return undefined;
      }
    },
    staleTime: 1 * 60 * 1000,
  });
}

export function useClockMutation() {
  const queryClient = useQueryClient();
  const addMutation = useSyncStore((state) => state.addMutation);

  return useMutation<ClockResponse | null, Error, ClockRequest>({
    mutationFn: async (payload: ClockRequest) => {
      if (!payload.clocked_at) {
        payload.clocked_at = new Date().toISOString();
      }

      if (!navigator.onLine) {
        addMutation({
          type: 'CLOCK',
          endpoint: '/mobile/attendance/clock',
          method: 'POST',
          payload,
        });

        const optimisticClock: ClockResponse = {
          id: Date.now(),
          action: payload.action || payload.clock_type || 'in',
          clocked_at: payload.clocked_at,
          latitude: payload.latitude,
          longitude: payload.longitude,
          accuracy_meters: payload.accuracy_meters,
          notes: payload.notes,
          verified: false,
          within_geofence: true,
          out_of_station_request_id: payload.out_of_station_request_id ?? null,
        };

        // Update local query cache optimistically
        queryClient.setQueryData<ClockResponse[]>(ATTENDANCE_QUERY_KEYS.clocks(), (old = []) => [
          optimisticClock,
          ...old,
        ]);

        return optimisticClock;
      }

      const res = await attendanceService.clock(payload);
      return res;
    },
    onSuccess: (newClock) => {
      if (newClock) {
        queryClient.setQueryData<ClockResponse[]>(ATTENDANCE_QUERY_KEYS.clocks(), (old = []) => {
          const exists = old.some((c) => c.id === newClock.id);
          if (exists) return old;
          return [newClock, ...old];
        });
      }
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEYS.all });
    },
  });
}

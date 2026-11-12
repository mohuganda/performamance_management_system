import { useMutation, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import attendanceService from '../api/attendance/service';
import { ClockRequest, ClockResponse, ClockListParams } from '../api/attendance/types';
import { useSyncStore } from '../stores/syncStore';
import { useAuthStore } from '../stores/authStore';
import { getUserCache, setUserCache } from '../utils/userCache';

export const ATTENDANCE_QUERY_KEYS = {
  all: ['attendance'] as const,
  clocks: (userId?: number | string | null, params?: ClockListParams) =>
    [...ATTENDANCE_QUERY_KEYS.all, userId ?? 'anonymous', 'clocks', params] as const,
};

export function useAttendanceListQuery(params?: ClockListParams): UseQueryResult<ClockResponse[], Error> {
  const userId = useAuthStore((s) => s.user?.id || s.staffId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ATTENDANCE_QUERY_KEYS.clocks(userId, params),
    queryFn: async () => {
      const clocks = await attendanceService.listClocks(params);
      if (clocks && userId) {
        setUserCache('attendance-cache', userId, clocks);
      }
      return clocks;
    },
    initialData: () => {
      if (!userId) return undefined;
      return getUserCache<ClockResponse[]>('attendance-cache', userId);
    },
    enabled: Boolean(isAuthenticated && userId),
    staleTime: 1 * 60 * 1000,
  });
}

export function useClockMutation() {
  const queryClient = useQueryClient();
  const addMutation = useSyncStore((state) => state.addMutation);
  const userId = useAuthStore((state) => state.user?.id || state.staffId);

  return useMutation<ClockResponse | null, Error, ClockRequest>({
    mutationFn: async (payload: ClockRequest) => {
      if (!payload.clocked_at) {
        payload.clocked_at = new Date().toISOString();
      }

      if (!navigator.onLine) {
        addMutation({
          userId,
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
        queryClient.setQueryData<ClockResponse[]>(ATTENDANCE_QUERY_KEYS.clocks(userId), (old = []) => [
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
        queryClient.setQueryData<ClockResponse[]>(ATTENDANCE_QUERY_KEYS.clocks(userId), (old = []) => {
          const exists = old.some((c) => c.id === newClock.id);
          if (exists) return old;
          return [newClock, ...old];
        });
      }
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEYS.all });
    },
  });
}

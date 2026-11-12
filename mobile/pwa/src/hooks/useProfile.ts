import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import authService from '../api/auth/service';
import { MeResponse, UpdateProfilePayload } from '../api/auth/types';
import { useAuthStore } from '../stores/authStore';

export const PROFILE_QUERY_KEYS = {
  all: ['profile'] as const,
  me: (userId?: number | string | null) =>
    [...PROFILE_QUERY_KEYS.all, userId ?? 'anonymous', 'me'] as const,
};

export function useProfileQuery() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id || s.staffId);

  return useQuery<MeResponse, Error>({
    queryKey: PROFILE_QUERY_KEYS.me(userId),
    queryFn: () => authService.me(),
    enabled: Boolean(isAuthenticated && userId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const userId = useAuthStore((s) => s.user?.id || s.staffId);

  return useMutation<MeResponse, Error, UpdateProfilePayload>({
    mutationFn: async (payload: UpdateProfilePayload) => {
      return await authService.updateProfile(payload);
    },
    onSuccess: (updatedData) => {
      queryClient.setQueryData(PROFILE_QUERY_KEYS.me(userId), updatedData);
      refreshProfile();
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authService } from '../../api/auth/service';
import { useSyncStore } from '../../stores/syncStore';
import { UpdateProfilePayload, MeResponse } from '../../api/auth/types';
import { Toaster } from '../../utils/toast';
import i18n from '../i18n';
import { ProfileDbService } from '../../db/services/ProfileDbService';

export function useProfileSync() {
  return useQuery({
    queryKey: ['profile-me'],
    queryFn: async () => {
      const data = await authService.me();
      await ProfileDbService.syncProfile(data);
      return data;
    },
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  const addMutation = useSyncStore((state) => state.addMutation);

  return useMutation({
    mutationFn: async (payload: UpdateProfilePayload) => {
      addMutation({
        type: 'PROFILE_UPDATE',
        endpoint: '/auth/profile',
        payload,
        method: 'PUT',
      });
      return payload;
    },
    onMutate: async (newProfileData: UpdateProfilePayload) => {
      // Optimistically update WatermelonDB
      try {
        await ProfileDbService.updateOptimistically(newProfileData);
      } catch (e) {
        console.error('Optimistic DB update failed', e);
      }

      await queryClient.cancelQueries({ queryKey: ['profile-me'] });
      const previousProfile = queryClient.getQueryData<MeResponse>(['profile-me']);

      queryClient.setQueryData<MeResponse>(['profile-me'], (old) => {
        if (!old) return old;
        return {
          ...old,
          user: {
            ...old.user,
            ...old.user, // to keep typescript happy since user might be undefined
            ProfilePhoto: newProfileData.profile_photo !== undefined ? newProfileData.profile_photo : old.user?.ProfilePhoto,
            SignatureImage: newProfileData.signature_image !== undefined ? newProfileData.signature_image : old.user?.SignatureImage,
          } as NonNullable<MeResponse['user']>,
        };
      });

      return { previousProfile };
    },
    onError: (err, newProfileData, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(['profile-me'], context.previousProfile);
        // Note: Reverting WatermelonDB omitted for brevity, will pull fresh next sync
      }
      Toaster.error(i18n.t('profile_update_failed_desc'), i18n.t('profile_update_failed'));
    },
    onSuccess: () => {
      Toaster.success(i18n.t('profile_update_success_desc'), i18n.t('profile_update_success'));
    },
  });
}


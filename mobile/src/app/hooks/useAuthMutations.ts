import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import apiClient from '../../api/client';

export function useLoginMutation() {
  const login = useAuthStore((state) => state.login);
  return useMutation({
    mutationFn: async ({ email, password }: any) => {
      return await login(email, password);
    },
  });
}

export function useRequestActivationMutation() {
  return useMutation({
    mutationFn: async (email: string) => {
      const res = await apiClient.post('/auth/request-activation', { email });
      return res.data;
    },
  });
}

export function useCompleteActivationMutation() {
  return useMutation({
    mutationFn: async ({ email, token, password }: any) => {
      const res = await apiClient.post('/auth/activation/complete', { email, token, password });
      return res.data;
    },
  });
}

import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import authService from '../../api/auth/service';
import {
  LoginRequest,
  LoginResponse,
  CompleteActivationRequest,
  CompleteActivationResponse,
  RequestActivationResponse,
} from '../../api/auth/types';

export function useLoginMutation() {
  const login = useAuthStore((state) => state.login);
  return useMutation<LoginResponse, Error, LoginRequest>({
    mutationFn: async ({ email, password }) => {
      return await login(email, password);
    },
  });
}

export function useRequestActivationMutation() {
  return useMutation<RequestActivationResponse, Error, string>({
    mutationFn: async (email) => {
      return await authService.requestActivation({ email });
    },
  });
}

export function useCompleteActivationMutation() {
  return useMutation<CompleteActivationResponse, Error, CompleteActivationRequest>({
    mutationFn: async ({ email, token, password }) => {
      return await authService.completeActivation({ email, token, password });
    },
  });
}

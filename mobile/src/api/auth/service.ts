import apiClient from '../client';
import {
  LoginRequest,
  LoginResponse,
  RequestActivationRequest,
  RequestActivationResponse,
  CompleteActivationRequest,
  CompleteActivationResponse,
  MeResponse,
  UpdateProfilePayload,
} from './types';

export const authService = {
  async login(payload: LoginRequest): Promise<LoginResponse> {
    const res = await apiClient.post<LoginResponse>('/auth/login', payload);
    return res.data;
  },

  async requestActivation(payload: RequestActivationRequest): Promise<RequestActivationResponse> {
    const res = await apiClient.post<RequestActivationResponse>('/auth/request-activation', payload);
    return res.data;
  },

  async completeActivation(payload: CompleteActivationRequest): Promise<CompleteActivationResponse> {
    const res = await apiClient.post<CompleteActivationResponse>('/auth/activation/complete', payload);
    return res.data;
  },

  async me(): Promise<MeResponse> {
    const res = await apiClient.get<MeResponse>('/auth/me');
    return res.data;
  },

  async updateProfile(payload: UpdateProfilePayload): Promise<MeResponse> {
    const res = await apiClient.put<MeResponse>('/auth/profile', payload);
    return res.data;
  },

  async refresh(): Promise<{ token: string; token_type: string }> {
    const res = await apiClient.post<{ token: string; token_type: string }>('/auth/refresh');
    return res.data;
  },
};
export default authService;

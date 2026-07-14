import apiClient from '../client';
import {
  LoginRequest,
  LoginResponse,
  RequestActivationRequest,
  RequestActivationResponse,
  CompleteActivationRequest,
  CompleteActivationResponse,
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
};
export default authService;

import apiClient from '../client';
import { ClockRequest, ClockResponse, ClockListParams } from './types';

export const attendanceService = {
  async clock(payload: ClockRequest): Promise<ClockResponse> {
    const res = await apiClient.post<ClockResponse>('/mobile/attendance/clock', payload);
    return res.data;
  },

  async listClocks(params?: ClockListParams): Promise<ClockResponse[]> {
    const res = await apiClient.get<ClockResponse[]>('/mobile/attendance/clocks', { params });
    return res.data;
  },
};

export default attendanceService;

import apiClient from '../client';
import { QueuedMutation } from './types';

export const syncService = {
  async processMutation(mutation: Omit<QueuedMutation, 'id'>): Promise<any> {
    const method = mutation.method || 'POST';
    const res = await apiClient({
      method,
      url: mutation.endpoint,
      data: mutation.payload,
    });
    return res.data;
  },
};

export default syncService;

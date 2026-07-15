import apiClient from '../client';
import { QueuedMutation } from './types';

export const syncService = {
  async processMutation(mutation: Omit<QueuedMutation, 'id'>): Promise<any> {
    const res = await apiClient.post(mutation.endpoint, mutation.payload);
    return res.data;
  },
};

export default syncService;

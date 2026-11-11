import apiClient from '../client';
import {
  ApprovalsInboxResponse,
  ApproveLeavePayload,
  ApproveOosPayload,
  ReviewAppraisalPayload,
  ReviewPpaPayload,
} from './types';

const approvalsService = {
  inbox: async (): Promise<ApprovalsInboxResponse> => {
    const { data } = await apiClient.get('/mobile/approvals/inbox');
    return data;
  },

  approveLeave: async (id: number, payload: ApproveLeavePayload) => {
    const { data } = await apiClient.post(`/mobile/leave/approvals/${id}`, payload);
    return data;
  },

  approveOos: async (id: number, payload: ApproveOosPayload) => {
    const { data } = await apiClient.post(`/mobile/out-of-station/approvals/${id}`, payload);
    return data;
  },

  reviewAppraisal: async (payload: ReviewAppraisalPayload) => {
    const { data } = await apiClient.post('/mobile/performance/appraisal/review', payload);
    return data;
  },

  reviewPpa: async (payload: ReviewPpaPayload) => {
    const { data } = await apiClient.post('/mobile/performance/ppa/review', payload);
    return data;
  },
};

export default approvalsService;

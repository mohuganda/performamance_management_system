import apiClient from '../client';
import {
  LeavePolicyConfig,
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  LeaveSubmissionPayload,
  AttachmentUploadResponse,
} from './types';

// Helper to normalize PascalCase keys (from Go backend) or snake_case/camelCase
function getField<T>(row: any, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) {
      return row[key] as T;
    }
  }
  return undefined;
}

export const leaveService = {
  async getConfig(): Promise<LeavePolicyConfig> {
    const res = await apiClient.get<any>('/mobile/leave/config');
    // The web app has config under res.data.settings
    return res.data?.settings || res.data || {};
  },

  async listTypes(): Promise<LeaveType[]> {
    const res = await apiClient.get<unknown>('/mobile/leave/types');
    if (!Array.isArray(res.data)) return [];
    return res.data
      .map((row: any): LeaveType | null => {
        const id = Number(getField<number>(row, 'id', 'ID'));
        const name = String(getField<string>(row, 'name', 'Name') ?? '');
        const code = String(getField<string>(row, 'code', 'Code') ?? '');
        const medicalRaw = getField<number>(row, 'medical_report_after_days', 'MedicalReportAfterDays');
        const advanceRaw = getField<number>(row, 'advance_notice_days', 'AdvanceNoticeDays');
        if (!id || !name) return null;
        return {
          id,
          name,
          code,
          advance_notice_days: medicalRaw != null ? Number(advanceRaw) : undefined,
          medical_report_after_days: medicalRaw != null ? Number(medicalRaw) : undefined,
        };
      })
      .filter((item): item is LeaveType => item !== null);
  },

  async listBalances(year?: number): Promise<LeaveBalance[]> {
    const res = await apiClient.get<any[]>('/mobile/leave/balances', {
      params: year ? { year } : undefined,
    });
    if (!Array.isArray(res.data)) return [];
    return res.data.map((row: any): LeaveBalance => {
      return {
        id: getField<number>(row, 'id', 'ID'),
        leave_type_id: Number(getField<number>(row, 'leave_type_id', 'LeaveTypeID')),
        entitled_days: Number(getField<number>(row, 'entitled_days', 'EntitledDays') ?? 0),
        used_days: Number(getField<number>(row, 'used_days', 'UsedDays') ?? 0),
        carried_over_days: Number(getField<number>(row, 'carried_over_days', 'CarriedOverDays') ?? 0),
      };
    });
  },

  async listRequests(): Promise<LeaveRequest[]> {
    const res = await apiClient.get<any[]>('/mobile/leave/requests');
    if (!Array.isArray(res.data)) return [];
    return res.data.map((row: any): LeaveRequest => {
      return {
        id: Number(getField<number>(row, 'id', 'ID')),
        leave_type_id: Number(getField<number>(row, 'leave_type_id', 'LeaveTypeID')),
        start_date: String(getField<string>(row, 'start_date', 'StartDate') ?? ''),
        end_date: String(getField<string>(row, 'end_date', 'EndDate') ?? ''),
        status: String(getField<string>(row, 'status', 'Status') ?? 'pending').toLowerCase() as any,
        reason: String(getField<string>(row, 'reason', 'Reason') ?? ''),
        medical_report_url: getField<string>(row, 'medical_report_url', 'MedicalReportURL'),
        days_requested: getField<number>(row, 'days_requested', 'DaysRequested'),
      };
    });
  },

  async createRequest(payload: LeaveSubmissionPayload): Promise<any> {
    const res = await apiClient.post('/mobile/leave/requests', payload);
    return res.data;
  },

  async uploadAttachment(dataUrl: string, fileName: string): Promise<AttachmentUploadResponse> {
    const res = await apiClient.post<AttachmentUploadResponse>('/uploads', {
      data_url: dataUrl,
      file_name: fileName,
    });
    return res.data;
  },

  async approve(id: number, payload: { approve: boolean; comments?: string }): Promise<any> {
    const res = await apiClient.post(`/mobile/leave/approvals/${id}`, payload);
    return res.data;
  },
};

export default leaveService;

import apiClient from '../client';
import {
  OosReason,
  OosRequest,
  OosSubmissionPayload,
  OosApproval,
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

export const oosService = {
  async listReasons(): Promise<OosReason[]> {
    const res = await apiClient.get<any[]>('/mobile/out-of-station/reasons');
    if (!Array.isArray(res.data)) return [];
    return res.data
      .map((row: any): OosReason | null => {
        const id = Number(getField<number>(row, 'id', 'ID'));
        const reason = String(getField<string>(row, 'reason', 'Reason') ?? '');
        const isActive = Boolean(getField<boolean>(row, 'is_active', 'IsActive') ?? true);
        if (!id || !reason) return null;
        return { id, reason, is_active: isActive };
      })
      .filter((item): item is OosReason => item !== null);
  },

  async listRequests(): Promise<OosRequest[]> {
    const res = await apiClient.get<any[]>('/mobile/out-of-station/requests');
    if (!Array.isArray(res.data)) return [];
    return res.data.map((row: any): OosRequest => {
      return {
        id: Number(getField<number>(row, 'id', 'ID')),
        reason_id: Number(getField<number>(row, 'reason_id', 'ReasonID')),
        start_date: String(getField<string>(row, 'start_date', 'StartDate') ?? ''),
        end_date: String(getField<string>(row, 'end_date', 'EndDate') ?? ''),
        remarks: getField<string>(row, 'remarks', 'Remarks'),
        expected_deliverables: getField<string>(row, 'expected_deliverables', 'ExpectedDeliverables'),
        attachment_url: getField<string>(row, 'attachment_url', 'AttachmentURL'),
        destination_name: String(getField<string>(row, 'destination_name', 'DestinationName') ?? ''),
        destination_address: getField<string>(row, 'destination_address', 'DestinationAddress'),
        destination_latitude: Number(getField<number>(row, 'destination_latitude', 'DestinationLatitude') ?? 0),
        destination_longitude: Number(getField<number>(row, 'destination_longitude', 'DestinationLongitude') ?? 0),
        geofence_radius_meters: Number(getField<number>(row, 'geofence_radius_meters', 'GeofenceRadiusMeters') ?? 500),
        status: String(getField<string>(row, 'status', 'Status') ?? 'pending').toLowerCase() as any,
        created_at: getField<string>(row, 'created_at', 'CreatedAt'),
        submitted_at: getField<string>(row, 'submitted_at', 'SubmittedAt'),
      };
    });
  },

  async listPendingApprovals(): Promise<OosApproval[]> {
    const res = await apiClient.get<any[]>('/mobile/out-of-station/pending-approvals');
    if (!Array.isArray(res.data)) return [];
    return res.data.map((row: any): OosApproval => {
      // The Go backend's /mobile/out-of-station/pending-approvals endpoint returns objects with structure:
      // approval_id, staff_name, reason_name, start_date, end_date, destination, remarks, expected_deliverables, attachment_url
      return {
        approval_id: Number(getField<number>(row, 'approval_id', 'ApprovalID')),
        request_id: Number(getField<number>(row, 'request_id', 'OutOfStationRequestID', 'RequestID')),
        staff_name: String(getField<string>(row, 'staff_name', 'StaffName') ?? ''),
        reason_name: String(getField<string>(row, 'reason_name', 'ReasonName') ?? ''),
        start_date: String(getField<string>(row, 'start_date', 'StartDate') ?? ''),
        end_date: String(getField<string>(row, 'end_date', 'EndDate') ?? ''),
        destination: String(getField<string>(row, 'destination', 'Destination') ?? ''),
        remarks: getField<string>(row, 'remarks', 'Remarks'),
        expected_deliverables: getField<string>(row, 'expected_deliverables', 'ExpectedDeliverables'),
        attachment_url: getField<string>(row, 'attachment_url', 'AttachmentURL'),
      };
    });
  },

  async createRequest(payload: OosSubmissionPayload): Promise<any> {
    const res = await apiClient.post('/mobile/out-of-station/requests', payload);
    return res.data;
  },

  async approve(id: number, payload: { approve: boolean; comments?: string }): Promise<any> {
    const res = await apiClient.post(`/mobile/out-of-station/approvals/${id}`, payload);
    return res.data;
  },
};

export default oosService;

export interface OosReason {
  id: number;
  reason: string;
  is_active: boolean;
}

export interface OosRequest {
  id: number;
  reason_id: number;
  start_date: string;
  end_date: string;
  remarks?: string;
  expected_deliverables?: string;
  attachment_url?: string;
  destination_name: string;
  destination_address?: string;
  destination_latitude: number;
  destination_longitude: number;
  geofence_radius_meters: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'pending_sync';
  created_at?: string;
  submitted_at?: string;
  staff_name?: string;
}

export interface OosSubmissionPayload {
  reason_id: number;
  start_date: string;
  end_date: string;
  remarks?: string;
  expected_deliverables?: string;
  attachment_url?: string;
  destination_name: string;
  destination_address?: string;
  destination_latitude: number;
  destination_longitude: number;
  geofence_radius_meters?: number;
  submit: boolean;
}

export interface OosApproval {
  approval_id: number;
  request_id: number;
  staff_name: string;
  reason_name: string;
  start_date: string;
  end_date: string;
  destination: string;
  remarks?: string;
  expected_deliverables?: string;
  attachment_url?: string;
}

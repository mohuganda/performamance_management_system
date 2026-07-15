export interface LeavePolicyConfig {
  advance_notice_days?: number;
  enforce_advance_notice?: boolean;
  block_past_dates?: boolean;
  exempt_sick_leave_advance_notice?: boolean;
}

export interface LeaveType {
  id: number;
  name: string;
  code: string;
  advance_notice_days?: number | null;
  medical_report_after_days?: number | null;
}

export interface LeaveBalance {
  id?: number;
  leave_type_id: number;
  entitled_days: number;
  used_days: number;
  carried_over_days: number;
}

export interface LeaveRequest {
  id: number;
  leave_type_id: number;
  start_date: string;
  end_date: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  reason: string;
  medical_report_url?: string;
  days_requested?: number;
}

export interface LeaveSubmissionPayload {
  leave_type_id: number;
  start_date: string;
  end_date: string;
  reason: string;
  medical_report_url?: string;
  submit: boolean;
}

export interface AttachmentUploadResponse {
  url: string;
  name: string;
  mime_type: string;
  size: number;
}

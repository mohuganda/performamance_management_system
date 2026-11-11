export type ApprovalInboxItem = {
  id: string;
  module: 'leave' | 'oos' | 'performance' | 'ppa';
  type_label: string;
  staff_name: string;
  title: string;
  subtitle: string;
  status: string;
  stage_name?: string;
  submitted_at?: string;
  waiting_days: number;
  can_act: boolean;
  approval_id?: number;
  request_id?: number;
  report_id?: number;
  ppa_id?: number;
  meta?: Record<string, unknown>;
};

export type ApprovalInboxStats = {
  pending_total: number;
  leave_pending: number;
  oos_pending: number;
  performance_pending: number;
  ppa_pending: number;
  completed_count: number;
  avg_approval_hours: number;
  avg_approval_label: string;
};

export type ApprovalsInboxResponse = {
  stats: ApprovalInboxStats;
  pending: ApprovalInboxItem[];
  generated_at: string;
};

export type ApproveLeavePayload = {
  approve: boolean;
  comments?: string;
};

export type ApproveOosPayload = {
  approve: boolean;
  comments?: string;
};

export type ReviewAppraisalPayload = {
  report_id: number;
  decision: 'approve' | 'return';
  comments: string;
  comment_role: string;
};

export type ReviewPpaPayload = {
  ppa_id: number;
  approve: boolean;
  comments?: string;
};

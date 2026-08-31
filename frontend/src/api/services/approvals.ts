import type { AppraisalBundle } from '@/components/performance/PerformanceAppraisalSections'
import type {
  ApprovalTrailEntry,
  ApprovalWorkflowStep,
} from '@/components/molecules/ApprovalWorkflowPanel'
import apiClient from '../client'

export type ApprovalInboxItem = {
  id: string
  module: 'leave' | 'oos' | 'performance' | 'ppa'
  type_label: string
  staff_name: string
  title: string
  subtitle: string
  status: string
  stage_name?: string
  submitted_at?: string
  acted_at?: string
  waiting_days: number
  can_act: boolean
  approval_id?: number
  request_id?: number
  report_id?: number
  ppa_id?: number
  meta?: Record<string, unknown>
}

export type ApprovalInboxStats = {
  pending_total: number
  leave_pending: number
  oos_pending: number
  performance_pending: number
  ppa_pending: number
  completed_count: number
  history_count: number
  avg_approval_hours: number
  avg_approval_label: string
}

export type ApprovalsInboxResponse = {
  stats: ApprovalInboxStats
  pending: ApprovalInboxItem[]
  history: ApprovalInboxItem[]
  generated_at: string
}

export type ReviewKpiField = {
  ppa_kpi_id: number
  kpi_id: number
  code: string
  name: string
  frequency: string
  computation_category: string
  subject_area_name: string
  source: string
  weight_percentage: number
  target_value: number
  actual_value?: number
  narrative?: string
  progress_percent?: number
  is_cumulative: boolean
  prior_reports?: Array<{
    report_type: string
    label: string
    actual_value: number
  }>
  reporting_hint?: string
}

export type ReviewSubjectGroup = {
  subject_area_id: number
  subject_area_name: string
  kpis: ReviewKpiField[]
}

export type PpaReviewDetail = {
  ppa_id: number
  staff_id: number
  staff_name: string
  status: string
  total_weight: number
  financial_year: string
  submitted_at?: string
  approved_at?: string
  subject_groups: ReviewSubjectGroup[]
}

export type ReportReviewDetail = {
  report_id: number
  report_type: string
  report_label: string
  staff_id: number
  staff_name: string
  status: string
  financial_year: string
  submitted_at?: string
  ppa_id?: number
  ppa_status?: string
  subject_groups: ReviewSubjectGroup[]
  appraisal?: AppraisalBundle
}

export type UnifiedApprovalDetail = {
  module: ApprovalInboxItem['module']
  type_label: string
  staff_name: string
  title: string
  subtitle: string
  status: string
  stage_name?: string
  submitted_at?: string
  can_act: boolean
  approval_id?: number
  request_id?: number
  report_id?: number
  ppa_id?: number
  reason?: string
  approvers: ApprovalWorkflowStep[]
  trail: ApprovalTrailEntry[]
  meta?: Record<string, unknown>
}

export const approvalsService = {
  inbox: async (): Promise<ApprovalsInboxResponse> => {
    const { data } = await apiClient.get('/mobile/approvals/inbox')
    return data
  },
  getDetail: async (module: string, id: number): Promise<UnifiedApprovalDetail> => {
    const { data } = await apiClient.get('/mobile/approvals/detail', {
      params: { module, id },
    })
    return data
  },
  approveLeave: async (id: number, payload: { approve: boolean; comments?: string }) => {
    const { data } = await apiClient.post(`/mobile/leave/approvals/${id}`, payload)
    return data
  },
  approveOos: async (id: number, payload: { approve: boolean; comments?: string }) => {
    const { data } = await apiClient.post(`/mobile/out-of-station/approvals/${id}`, payload)
    return data
  },
  reviewAppraisal: async (payload: {
    report_id: number
    decision: 'approve' | 'return'
    comments: string
    comment_role: string
  }) => {
    const { data } = await apiClient.post('/mobile/performance/appraisal/review', payload)
    return data
  },
  reviewPpa: async (payload: { ppa_id: number; approve: boolean; comments?: string }) => {
    const { data } = await apiClient.post('/mobile/performance/ppa/review', payload)
    return data
  },
  getPpaReviewDetail: async (ppaId: number): Promise<PpaReviewDetail> => {
    const { data } = await apiClient.get('/mobile/performance/ppa/review-detail', {
      params: { ppa_id: ppaId },
    })
    return data
  },
  getReportReviewDetail: async (reportId: number): Promise<ReportReviewDetail> => {
    const { data } = await apiClient.get('/mobile/performance/report/review-detail', {
      params: { report_id: reportId },
    })
    return data
  },
}

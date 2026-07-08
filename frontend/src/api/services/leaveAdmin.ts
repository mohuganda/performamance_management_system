import apiClient from '../client'
import type { PaginatedResponse } from '@/types/pagination'
import { unwrapPaginated } from '@/types/pagination'
import { asArray } from '@/utils/asArray'
import { normalizeLeaveTypes } from '@/utils/normalizeApi'

export type LeavePolicySettings = {
  advance_notice_days: number
  work_hours: Record<string, string>
  carry_over_deadline: string
  clock_window_morning: string
  allow_carry_over: boolean
  vesting_month: number
  vesting_day: number
}

export type LeaveTypeAdmin = {
  id: number
  name: string
  code: string
  description?: string
  is_active: boolean
  max_days_per_year?: number
  max_days_per_request?: number
  advance_notice_days?: number
  medical_report_after_days?: number
  sort_order: number
  eligibility_notes?: string
  requires_supervisor_approval: boolean
  requires_hr_approval: boolean
  workflow_profile_code?: string
}

export type LeaveWorkflowProfile = {
  id: number
  code: string
  name: string
  description?: string
  is_default: boolean
  is_active: boolean
}

export type LeaveApprovalStage = {
  id: number
  code: string
  name: string
  sequence: number
  approver_role: string
  description?: string
  is_active: boolean
  workflow_profile_code?: string
  stage_type?: string
  scope?: string
  job_title_id?: number | null
  job_title_match?: string | null
  supervisor_sequence?: number | null
  is_required?: boolean
  skip_if_unresolved?: boolean
}

export type LeaveGradeEntitlement = {
  id: number
  salary_grade: string
  leave_type_id: number
  days_per_year: number
  medical_report_after_days?: number
  requires_hr_finalization: boolean
}

export type LeaveBalanceRow = {
  leave_type_id: number
  leave_type_name: string
  leave_type_code: string
  calendar_year: number
  entitled_days: number
  used_days: number
  carried_over_days: number
  remaining_days: number
}

export type LeaveEntitlement = LeaveGradeEntitlement

export type StaffLeaveSummary = {
  staff_id: number
  staff_name: string
  email: string
  department_name: string
  facility_name: string
  job_title: string
  salary_grade?: string
  calendar_year: number
  annual_entitled: number
  annual_used: number
  annual_carried: number
  annual_remaining: number
  balances: LeaveBalanceRow[]
}

export type LeaveRequestAdmin = {
  id: number
  staff_id: number
  staff_name: string
  department_name: string
  facility_name: string
  leave_type_id: number
  leave_type_name: string
  leave_type_code: string
  start_date: string
  end_date: string
  days_requested: number
  status: string
  approval_stage: string
  submitted_at?: string
  awaiting_hr: boolean
  reason?: string
}

export type LeaveStatement = {
  staff_id: number
  staff_name: string
  email: string
  department_name: string
  facility_name: string
  job_title: string
  salary_grade?: string
  year: number
  summary: {
    total_entitled: number
    total_used: number
    total_carried: number
    total_remaining: number
    pending_requests: number
    approved_awaiting_hr: number
  }
  balances: LeaveBalanceRow[]
  requests: LeaveRequestAdmin[]
}

export type LeaveOverview = {
  year: number
  active_staff: number
  staff_with_balances: number
  pending_supervisor: number
  awaiting_hr_finalization: number
  carry_over_deadline: string
  advance_notice_days: number
  allow_carry_over: boolean
}

export const leaveAdminService = {
  overview: async (year?: number): Promise<LeaveOverview> => {
    const { data } = await apiClient.get('/admin/leave/overview', { params: { year } })
    return data
  },
  listBalances: async (params?: {
    search?: string
    department_id?: number
    year?: number
    page?: number
    per_page?: number
  }): Promise<PaginatedResponse<StaffLeaveSummary>> => {
    const { data } = await apiClient.get('/admin/leave/balances', { params })
    const page = unwrapPaginated<StaffLeaveSummary>(data)
    return { ...page, data: asArray<StaffLeaveSummary>(page.data) }
  },
  listRequests: async (params?: {
    search?: string
    status?: string
    awaiting_hr?: string
    leave_type_id?: number
    department_id?: number
    page?: number
    per_page?: number
  }): Promise<PaginatedResponse<LeaveRequestAdmin>> => {
    const { data } = await apiClient.get('/admin/leave/requests', { params })
    const page = unwrapPaginated<LeaveRequestAdmin>(data)
    return { ...page, data: asArray<LeaveRequestAdmin>(page.data) }
  },
  staffStatement: async (staffId: number, year?: number): Promise<LeaveStatement> => {
    const { data } = await apiClient.get(`/admin/leave/staff/${staffId}/statement`, { params: { year } })
    return data
  },
  finalizeRequest: async (requestId: number) => {
    const { data } = await apiClient.post(`/admin/leave/requests/${requestId}/finalize`)
    return data
  },
  adjustBalance: async (
    staffId: number,
    leaveTypeId: number,
    year: number,
    payload: { entitled_days?: number; used_days?: number; carried_over_days?: number },
  ) => {
    const { data } = await apiClient.patch(`/admin/leave/staff/${staffId}/balances`, payload, {
      params: { leave_type_id: leaveTypeId, year },
    })
    return data as LeaveBalanceRow
  },
  initializeYear: async (year?: number) => {
    const { data } = await apiClient.post('/admin/leave/balances/initialize-year', null, { params: { year } })
    return data as { year: number; created: number; skipped: number; processed: number }
  },
  getSettings: async (): Promise<LeavePolicySettings> => {
    const { data } = await apiClient.get('/admin/leave/settings')
    return data
  },
  updateSettings: async (payload: Partial<LeavePolicySettings>) => {
    const { data } = await apiClient.put('/admin/leave/settings', payload)
    return data as LeavePolicySettings
  },
  listTypes: async (): Promise<LeaveTypeAdmin[]> => {
    const { data } = await apiClient.get('/admin/leave/types')
    return asArray<LeaveTypeAdmin>(data)
  },
  updateType: async (id: number, payload: Partial<LeaveTypeAdmin>) => {
    const { data } = await apiClient.put(`/admin/leave/types/${id}`, payload)
    return data as LeaveTypeAdmin
  },
  listEntitlements: async (): Promise<LeaveEntitlement[]> => {
    const { data } = await apiClient.get('/admin/leave/entitlements')
    return asArray<LeaveEntitlement>(data)
  },
  listApprovalStages: async (): Promise<LeaveApprovalStage[]> => {
    const { data } = await apiClient.get('/admin/leave/approval-stages')
    return asArray<LeaveApprovalStage>(data)
  },
  listWorkflowProfiles: async (): Promise<LeaveWorkflowProfile[]> => {
    const { data } = await apiClient.get('/admin/leave/workflow-profiles')
    return asArray<LeaveWorkflowProfile>(data)
  },
  listWorkflowStages: async (profile = 'default'): Promise<LeaveApprovalStage[]> => {
    const { data } = await apiClient.get('/admin/leave/workflow-stages', { params: { profile } })
    return asArray<LeaveApprovalStage>(data)
  },
  createApprovalStage: async (payload: Partial<LeaveApprovalStage>) => {
    const { data } = await apiClient.post('/admin/leave/approval-stages', payload)
    return data as LeaveApprovalStage
  },
  updateApprovalStage: async (id: number, payload: Partial<LeaveApprovalStage>) => {
    const { data } = await apiClient.put(`/admin/leave/approval-stages/${id}`, payload)
    return data as LeaveApprovalStage
  },
  deleteApprovalStage: async (id: number) => {
    const { data } = await apiClient.delete(`/admin/leave/approval-stages/${id}`)
    return data
  },
  listDepartments: async () => {
    const { data } = await apiClient.get('/admin/leave/departments')
    return asArray<{ id: number; name: string }>(data)
  },
  listLeaveTypesSimple: async () => normalizeLeaveTypes((await apiClient.get('/admin/leave/types')).data),
}

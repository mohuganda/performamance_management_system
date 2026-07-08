import apiClient from '../client'
import { normalizeLeaveTypes } from '@/utils/normalizeApi'

export const leaveService = {
  getConfig: async () => {
    const { data } = await apiClient.get('/mobile/leave/config')
    return data
  },
  listTypes: async () => {
    const { data } = await apiClient.get('/mobile/leave/types')
    return normalizeLeaveTypes(data)
  },
  listBalances: async (year?: number) => {
    const { data } = await apiClient.get('/mobile/leave/balances', {
      params: year ? { year } : undefined,
    })
    return data
  },
  listRequests: async () => {
    const { data } = await apiClient.get('/mobile/leave/requests')
    return data
  },
  listPendingApprovals: async () => {
    const { data } = await apiClient.get('/mobile/leave/pending-approvals')
    return data
  },
  createRequest: async (payload: {
    leave_type_id: number
    start_date: string
    end_date: string
    reason: string
    medical_report_url?: string
    submit: boolean
  }) => {
    const { data } = await apiClient.post('/mobile/leave/requests', payload)
    return data
  },
  approve: async (id: number, payload: { approve: boolean; comments?: string }) => {
    const { data } = await apiClient.post(`/mobile/leave/approvals/${id}`, payload)
    return data
  },
}

export const performanceService = {
  summary: async () => {
    const { data } = await apiClient.get('/mobile/performance/summary')
    return data
  },
  windows: async () => {
    const { data } = await apiClient.get('/mobile/performance/windows')
    return data
  },
  listKpis: async () => {
    const { data } = await apiClient.get('/mobile/performance/kpis/grouped')
    return data
  },
  reportForm: async (reportType: string) => {
    const { data } = await apiClient.get('/mobile/performance/report-form', {
      params: { report_type: reportType },
    })
    return data
  },
  savePlan: async (payload: {
    kpis: Array<{ kpi_id: number; weight_percentage: number; target_value: number }>
  }) => {
    const { data } = await apiClient.post('/mobile/performance/ppa', payload)
    return data
  },
  submitPlan: async () => {
    const { data } = await apiClient.post('/mobile/performance/ppa/submit')
    return data
  },
  submitReport: async (payload: {
    report_type: string
    entries: Array<{ ppa_kpi_id: number; actual_value: number; narrative: string }>
  }) => {
    const { data } = await apiClient.post('/mobile/performance/reports', payload)
    return data
  },
  saveAppraisal: async (payload: {
    report_type: string
    action_plans: Array<{ performance_gap: string; agreed_action: string; time_frame: string }>
    appraisee_comments: string
  }) => {
    const { data } = await apiClient.post('/mobile/performance/appraisal', payload)
    return data
  },
  getAppraisal: async (reportId: number) => {
    const { data } = await apiClient.get('/mobile/performance/appraisal', {
      params: { report_id: reportId },
    })
    return data
  },
  listPendingAppraisals: async () => {
    const { data } = await apiClient.get('/mobile/performance/pending-appraisals')
    return data
  },
  reviewAppraisal: async (payload: {
    report_id: number
    decision: 'approve' | 'return'
    comments: string
    job_title?: string
    comment_role: string
  }) => {
    const { data } = await apiClient.post('/mobile/performance/appraisal/review', payload)
    return data
  },
  statusReport: async () => {
    const { data } = await apiClient.get('/mobile/performance/status-report')
    return data
  },
  overallRating: async () => {
    const { data } = await apiClient.get('/mobile/performance/overall-rating')
    return data
  },
}

export const oosService = {
  listReasons: async () => {
    const { data } = await apiClient.get('/mobile/out-of-station/reasons')
    return data
  },
  listRequests: async () => {
    const { data } = await apiClient.get('/mobile/out-of-station/requests')
    return data
  },
  listPendingApprovals: async () => {
    const { data } = await apiClient.get('/mobile/out-of-station/pending-approvals')
    return data
  },
  createRequest: async (payload: {
    reason_id: number
    start_date: string
    end_date: string
    remarks?: string
    destination_name?: string
    destination_latitude: number
    destination_longitude: number
    submit: boolean
  }) => {
    const { data } = await apiClient.post('/mobile/out-of-station/requests', payload)
    return data
  },
  approve: async (id: number, payload: { approve: boolean; comments?: string }) => {
    const { data } = await apiClient.post(`/mobile/out-of-station/approvals/${id}`, payload)
    return data
  },
}

export const attendanceService = {
  clock: async (payload: {
    action: 'in' | 'out'
    latitude: number
    longitude: number
    accuracy_meters?: number
    notes?: string
  }) => {
    const { data } = await apiClient.post('/mobile/attendance/clock', payload)
    return data
  },
  listClocks: async (params?: { from?: string; to?: string }) => {
    const { data } = await apiClient.get('/mobile/attendance/clocks', { params })
    return data
  },
}

export const staffAdminService = {
  listSupervision: async (params?: {
    search?: string
    has_supervisor?: string
    page?: number
    per_page?: number
  }) => {
    const { data } = await apiClient.get('/admin/staff/supervision', { params })
    return data
  },
  listSupervisorCandidates: async () => {
    const { data } = await apiClient.get('/admin/staff/supervisor-candidates')
    return data
  },
  assignSupervisor: async (staffId: number, supervisorStaffId: number) => {
    const { data } = await apiClient.post('/admin/staff/supervision', {
      staff_id: staffId,
      supervisor_staff_id: supervisorStaffId,
    })
    return data
  },
  removeSupervisor: async (staffId: number) => {
    const { data } = await apiClient.delete(`/admin/staff/supervision/${staffId}`)
    return data
  },
}

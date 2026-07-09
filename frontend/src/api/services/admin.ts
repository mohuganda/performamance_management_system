import apiClient from '../client'
import { normalizeDepartments, normalizeStaffList, normalizeSupervisorCandidates, normalizeSupervisors, type StaffListRow, type SupervisorAssignment, type SupervisorCandidate } from '@/utils/normalizeApi'
import type { PaginatedResponse } from '@/types/pagination'
import { unwrapPaginated } from '@/types/pagination'

export type { StaffListRow, SupervisorAssignment, SupervisorCandidate }

export type IhrisSyncStatus = {
  run_id?: number
  status: string
  current_page?: number
  total_pages?: number
  total_records?: number
  processed_records?: number
  imported_records?: number
  skipped_records?: number
  failed_records?: number
  last_error?: string
  has_more?: boolean
  started_at?: string
  finished_at?: string
}

export type IhrisSyncBatchResult = IhrisSyncStatus & {
  sync_result?: {
    facilities_upserted: number
    departments_upserted: number
    jobs_upserted: number
    staff_upserted: number
    contracts_created: number
    contracts_ended: number
  }
}

export type AdminSettings = {
  data_sources: {
    ihris: {
      api_url: string
      sync_enabled: boolean
      use_demo_data: boolean
      overwrite_enabled?: boolean
      require_email: boolean
      require_mobile: boolean
      last_sync_at: string
      last_sync_status: string
    }
    hrm_attend?: {
      api_url: string
      summary_path?: string
      enabled: boolean
      last_sync_at: string
      last_sync_status?: string
    }
  }
  email: {
    driver: 'smtp' | 'exchange'
    smtp: Record<string, string>
    exchange: Record<string, string>
  }
  notifications: Record<
    string,
    { enabled: boolean; days_before: string; description: string }
  >
  ui?: {
    admin_page_size: number
  }
}

export type Department = { id: number; name: string }

export const adminSettingsService = {
  get: async (): Promise<AdminSettings> => {
    const { data } = await apiClient.get('/admin/settings')
    return data
  },
  update: async (group: string, payload: Record<string, unknown>) => {
    const { data } = await apiClient.put('/admin/settings', { group, payload })
    return data as AdminSettings
  },
  sendReminders: async () => {
    const { data } = await apiClient.post('/admin/notifications/send-reminders')
    return data
  },
}

export type PerformanceReportingSettings = {
  enforce_windows: boolean
  test_override: boolean
  window_weeks: number
  window_shift_days: number
}

export type PerformanceWindowStatus = {
  phase: string
  label: string
  coverage_period: string
  reporting_window: string
  status: 'open' | 'upcoming' | 'closed'
  is_open: boolean
  open_at: string
  close_at: string
  days_remaining: number
}

export type PerformanceReportingConfig = {
  financial_year?: string
  settings: PerformanceReportingSettings
  windows: PerformanceWindowStatus[]
}

export const performanceAdminService = {
  getSettings: async (): Promise<PerformanceReportingConfig> => {
    const { data } = await apiClient.get('/admin/performance/settings')
    return data
  },
  updateSettings: async (payload: Partial<PerformanceReportingSettings>) => {
    const { data } = await apiClient.put('/admin/performance/settings', payload)
    return data as PerformanceReportingConfig
  },
}

export const ihrisAdminService = {
  status: async (): Promise<IhrisSyncStatus> => {
    const { data } = await apiClient.get('/ihris/sync/status')
    return data
  },
  syncBatch: async (opts?: { run_id?: number; start_page?: number; pages_per_batch?: number }) => {
    const { data } = await apiClient.post<IhrisSyncBatchResult>('/ihris/sync', opts ?? {})
    return data
  },
}

export type HrmAttendSyncResult = {
  status: string
  year_month: string
  imported: number
  skipped_unknown: number
  skipped_invalid: number
  total_fetched: number
  message?: string
}

export const hrmAttendAdminService = {
  syncSummaries: async (opts?: { year_month?: string }): Promise<HrmAttendSyncResult> => {
    const { data } = await apiClient.post<HrmAttendSyncResult>('/hrm-attend/sync', opts ?? {})
    return data
  },
}

export const staffManagementService = {
  list: async (params?: {
    search?: string
    department_id?: number
    has_supervisor?: string
    page?: number
    per_page?: number
  }): Promise<PaginatedResponse<StaffListRow>> => {
    const { data } = await apiClient.get('/admin/staff', { params })
    const page = unwrapPaginated<Record<string, unknown>>(data)
    return {
      ...page,
      data: normalizeStaffList(page.data),
    }
  },
  listDepartments: async (): Promise<Department[]> => {
    const { data } = await apiClient.get('/admin/staff/departments')
    return normalizeDepartments(data)
  },
  updateHrProfile: async (
    staffId: number,
    payload: {
      hr_department_id?: number
      hr_email?: string
      hr_mobile?: string
      notes?: string
      lock_email?: boolean
      lock_department?: boolean
      lock_mobile?: boolean
    },
  ) => {
    const { data } = await apiClient.patch(`/admin/staff/${staffId}/hr-profile`, payload)
    return data
  },
  listSupervisorCandidates: async (): Promise<SupervisorCandidate[]> => {
    const { data } = await apiClient.get('/admin/staff/supervisor-candidates')
    return normalizeSupervisorCandidates(data)
  },
  getSupervisors: async (staffId: number): Promise<SupervisorAssignment[]> => {
    const { data } = await apiClient.get(`/admin/staff/${staffId}/supervisors`)
    return normalizeSupervisors(data)
  },
  setSupervisors: async (
    staffId: number,
    supervisors: { sequence: number; supervisor_staff_id: number }[],
  ) => {
    const { data } = await apiClient.put(`/admin/staff/${staffId}/supervisors`, { supervisors })
    return data
  },
}

import apiClient from '../client'
import { normalizeLeaveTypes } from '@/utils/normalizeApi'

export const uploadService = {
  uploadAttachment: async (payload: { data_url: string; file_name: string }) => {
    const { data } = await apiClient.post<{
      url: string
      name: string
      mime_type: string
      size: number
    }>('/uploads', payload)
    return data
  },
}

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
    clarification?: string
    medical_report_url?: string
    oic_staff_id: number
    submit: boolean
  }) => {
    const { data } = await apiClient.post('/mobile/leave/requests', payload)
    return data
  },
  updateRequest: async (
    id: number,
    payload: {
      leave_type_id: number
      start_date: string
      end_date: string
      reason: string
      clarification?: string
      medical_report_url?: string
      oic_staff_id: number
      submit?: boolean
    },
  ) => {
    const { data } = await apiClient.put(`/mobile/leave/requests/${id}`, payload)
    return data
  },
  submitRequest: async (id: number) => {
    const { data } = await apiClient.post(`/mobile/leave/requests/${id}/submit`)
    return data
  },
  listOicCandidates: async () => {
    const { data } = await apiClient.get<
      Array<{ staff_id: number; name: string; job_title?: string }>
    >('/mobile/leave/oic-candidates')
    return data
  },
  recallRequest: async (id: number) => {
    const { data } = await apiClient.post(`/mobile/leave/requests/${id}/recall`)
    return data
  },
  cancelRequest: async (id: number) => {
    const { data } = await apiClient.post(`/mobile/leave/requests/${id}/cancel`)
    return data
  },
  deleteRequest: async (id: number) => {
    const { data } = await apiClient.delete(`/mobile/leave/requests/${id}`)
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
  getRequest: async (id: number) => {
    const { data } = await apiClient.get(`/mobile/out-of-station/requests/${id}`)
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
    expected_deliverables?: string
    clarification?: string
    attachment_url?: string
    destination_name?: string
    destination_address?: string
    destination_latitude: number
    destination_longitude: number
    geofence_radius_meters?: number
    cached_place_id?: number
    submit: boolean
  }) => {
    const { data } = await apiClient.post('/mobile/out-of-station/requests', payload)
    return data
  },
  updateRequest: async (
    id: number,
    payload: {
      reason_id: number
      start_date: string
      end_date: string
      remarks?: string
      expected_deliverables?: string
      clarification?: string
      attachment_url?: string
      destination_name?: string
      destination_address?: string
      destination_latitude: number
      destination_longitude: number
      geofence_radius_meters?: number
      cached_place_id?: number
      submit?: boolean
    },
  ) => {
    const { data } = await apiClient.put(`/mobile/out-of-station/requests/${id}`, payload)
    return data
  },
  submitRequest: async (id: number) => {
    const { data } = await apiClient.post(`/mobile/out-of-station/requests/${id}/submit`)
    return data
  },
  cancelRequest: async (id: number) => {
    const { data } = await apiClient.post(`/mobile/out-of-station/requests/${id}/cancel`)
    return data
  },
  recallRequest: async (id: number) => {
    const { data } = await apiClient.post(`/mobile/out-of-station/requests/${id}/recall`)
    return data
  },
  deleteRequest: async (id: number) => {
    const { data } = await apiClient.delete(`/mobile/out-of-station/requests/${id}`)
    return data
  },
  approve: async (id: number, payload: { approve: boolean; comments?: string }) => {
    const { data } = await apiClient.post(`/mobile/out-of-station/approvals/${id}`, payload)
    return data
  },
}

export type AttendanceClockRow = {
  id: number
  clock_type: string
  clocked_at: string
  latitude: number
  longitude: number
  verification_status: string
  out_of_station_request_id?: number | null
  distance_from_destination_meters?: number | null
  location_accuracy_percent?: number | null
  accuracy_meters?: number | null
  location_label?: string | null
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function normalizeAttendanceClock(raw: unknown): AttendanceClockRow {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const id = Number(row.id ?? row.ID ?? 0)
  return {
    id,
    clock_type: String(row.clock_type ?? row.ClockType ?? row.action ?? ''),
    clocked_at: String(row.clocked_at ?? row.ClockedAt ?? row.created_at ?? row.CreatedAt ?? ''),
    latitude: Number(row.latitude ?? row.Latitude ?? 0),
    longitude: Number(row.longitude ?? row.Longitude ?? 0),
    verification_status: String(
      row.verification_status ?? row.VerificationStatus ?? 'pending',
    ),
    out_of_station_request_id: numOrNull(
      row.out_of_station_request_id ?? row.OutOfStationRequestID,
    ),
    distance_from_destination_meters: numOrNull(
      row.distance_from_destination_meters ?? row.DistanceFromDestinationMeters,
    ),
    location_accuracy_percent: numOrNull(
      row.location_accuracy_percent ?? row.LocationAccuracyPercent,
    ),
    accuracy_meters: numOrNull(row.accuracy_meters ?? row.AccuracyMeters),
    location_label:
      row.location_label != null || row.LocationLabel != null
        ? String(row.location_label ?? row.LocationLabel)
        : null,
  }
}

export const attendanceService = {
  clock: async (payload: {
    clock_type: 'in' | 'out'
    latitude: number
    longitude: number
    accuracy_meters?: number
    location_label?: string
    out_of_station_request_id?: number
  }) => {
    const { data } = await apiClient.post('/mobile/attendance/clock', payload)
    return normalizeAttendanceClock(data)
  },
  listClocks: async (params?: { from?: string; to?: string }) => {
    const { data } = await apiClient.get('/mobile/attendance/clocks', { params })
    const rows = Array.isArray(data) ? data : Array.isArray((data as { data?: unknown })?.data)
      ? ((data as { data: unknown[] }).data)
      : []
    return rows.map(normalizeAttendanceClock)
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

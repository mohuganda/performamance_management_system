export type AttendanceIntegration = {
  title: string
  connection: {
    status: string
    base_url: string
    last_sync_at?: string
    message?: string
  }
  pms_tracks: string[]
  hrm_attend_provides: string[]
  pms_exports_to_hrm: string[]
  combined_outcome: string
}

export type DistrictCoverage = {
  district_id: string
  district: string
  region?: string
  staff_count: number
  oos_attendance_rate: number
  hrm_summary_rate: number
  combined_rate: number
  lat: number
  lon: number
}

export type AttendancePerformance = {
  target: number
  overall_combined: number
  oos_compliance: number
  districts_on_system: number
  staff_tracked: number
}

export type AttendanceTrends = {
  labels: string[]
  series: {
    hrm_duty_station: number[]
    pms_out_of_station: number[]
    combined_full_record: number[]
  }
  target: number
}

export type PersonalAttendanceRow = {
  month: string
  oos_attendance_percent: number
  hrm_summary_percent: number
  combined_percent: number
  target: number
  oos_clock_events?: number
  status: string
}

export type OrgContext = {
  scope_level: string
  institution_type?: string
  facility?: string
  department?: string
  division?: string
  section?: string
  unit?: string
  region?: string
  district?: string
  display_context: string
  breadcrumb: string[]
}

export type DashboardAnalytics = {
  attendance_integration?: AttendanceIntegration
  attendance_performance?: AttendancePerformance
  attendance_trends?: AttendanceTrends
  district_coverage?: DistrictCoverage[]
  personal_attendance?: PersonalAttendanceRow[]
  attendance_summary?: PersonalAttendanceRow[]
}

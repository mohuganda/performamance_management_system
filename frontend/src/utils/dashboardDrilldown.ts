import type { DistrictCoverage } from '@/types/dashboard'

export type FacilityPerformanceRow = {
  facility?: string
  institution?: string
  institution_type?: string
  district?: string
  region?: string
  staff?: number
  departments?: number
  avg_task_percent?: number
  attendance?: number
  active_pips?: number
  status?: string
}

export type DashboardDrilldown = {
  id: string
  title: string
  description: string
  columns: string[]
  rows: Array<Record<string, string | number>>
}

function formatStatus(status?: string) {
  if (!status) return '—'
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function facilityTableRows(rows: FacilityPerformanceRow[]) {
  return rows.map((row) => ({
    Facility: row.facility ?? row.institution ?? '—',
    'Institution type': row.institution_type ?? '—',
    District: row.district ?? '—',
    Staff: row.staff ?? 0,
    Depts: row.departments ?? '—',
    'Task %': `${row.avg_task_percent ?? 0}%`,
    Attendance: `${row.attendance ?? 0}%`,
    PIPs: row.active_pips ?? 0,
    Status: formatStatus(row.status),
  }))
}

function districtTableRows(rows: DistrictCoverage[]) {
  return rows.map((row) => ({
    District: row.district,
    ISO: row.iso_code ?? '—',
    Region: row.region ?? '—',
    Staff: row.staff_count,
    'OOS rate': `${row.oos_attendance_rate}%`,
    'HRM summary': `${row.hrm_summary_rate}%`,
    Combined: `${row.combined_rate}%`,
  }))
}

export function buildHrManagerDrilldowns(
  facilities: FacilityPerformanceRow[],
  districts: DistrictCoverage[],
  interventions: Array<Record<string, string>>,
  attendanceTarget: number,
): Record<string, DashboardDrilldown> {
  const allFacilityRows = facilityTableRows(facilities)
  const onTrack = facilities.filter((f) => f.status === 'on_track')
  const atRisk = facilities.filter((f) => f.status === 'at_risk')
  const offTrack = facilities.filter((f) => f.status === 'off_track')
  const belowAttendance = facilities.filter((f) => (f.attendance ?? 0) < attendanceTarget)
  const sortedByStaff = [...facilities].sort((a, b) => (b.staff ?? 0) - (a.staff ?? 0))

  return {
    combined_attendance: {
      id: 'combined_attendance',
      title: 'Combined attendance — facility detail',
      description: `Facilities below ${attendanceTarget}% attendance target (${belowAttendance.length} of ${facilities.length})`,
      columns: ['Facility', 'Institution type', 'District', 'Staff', 'Depts', 'Task %', 'Attendance', 'PIPs', 'Status'],
      rows: facilityTableRows(
        belowAttendance.length > 0 ? belowAttendance : [...facilities].sort((a, b) => (a.attendance ?? 0) - (b.attendance ?? 0)),
      ),
    },
    oos_compliance: {
      id: 'oos_compliance',
      title: 'Out-of-station GPS compliance',
      description: 'District-level PMS clock and combined attendance rates',
      columns: ['District', 'ISO', 'Region', 'Staff', 'OOS rate', 'HRM summary', 'Combined'],
      rows: districtTableRows([...districts].sort((a, b) => b.oos_attendance_rate - a.oos_attendance_rate)),
    },
    districts: {
      id: 'districts',
      title: 'Districts on PMS',
      description: `${districts.length} districts with active staff contracts`,
      columns: ['District', 'ISO', 'Region', 'Staff', 'OOS rate', 'HRM summary', 'Combined'],
      rows: districtTableRows(districts),
    },
    staff_tracked: {
      id: 'staff_tracked',
      title: 'Staff tracked by facility',
      description: 'Staff counts from integrated iHRIS contracts',
      columns: ['Facility', 'Institution type', 'District', 'Staff', 'Depts', 'Task %', 'Attendance', 'PIPs', 'Status'],
      rows: facilityTableRows(sortedByStaff),
    },
    all_facilities: {
      id: 'all_facilities',
      title: 'All facilities',
      description: `${facilities.length} facilities in scope`,
      columns: ['Facility', 'Institution type', 'District', 'Staff', 'Depts', 'Task %', 'Attendance', 'PIPs', 'Status'],
      rows: allFacilityRows,
    },
    on_track: {
      id: 'on_track',
      title: 'Facilities on track',
      description: `${onTrack.length} facilities meeting task completion thresholds`,
      columns: ['Facility', 'Institution type', 'District', 'Staff', 'Depts', 'Task %', 'Attendance', 'PIPs', 'Status'],
      rows: facilityTableRows(onTrack),
    },
    at_risk: {
      id: 'at_risk',
      title: 'Facilities at risk',
      description: `${atRisk.length} facilities between 60–79% task completion`,
      columns: ['Facility', 'Institution type', 'District', 'Staff', 'Depts', 'Task %', 'Attendance', 'PIPs', 'Status'],
      rows: facilityTableRows(atRisk),
    },
    off_track: {
      id: 'off_track',
      title: 'Facilities off track',
      description: `${offTrack.length} facilities below 60% task completion — intervention may be required`,
      columns: ['Facility', 'Institution type', 'District', 'Staff', 'Depts', 'Task %', 'Attendance', 'PIPs', 'Status'],
      rows: facilityTableRows(offTrack),
    },
    task_completion: {
      id: 'task_completion',
      title: 'National task completion — on-track facilities',
      description: 'Facilities contributing to the on-track percentage',
      columns: ['Facility', 'Institution type', 'District', 'Staff', 'Depts', 'Task %', 'Attendance', 'PIPs', 'Status'],
      rows: facilityTableRows(onTrack),
    },
    interventions: {
      id: 'interventions',
      title: 'Intervention required',
      description: 'Off-track facilities flagged for HR follow-up',
      columns: ['Facility', 'Institution type', 'District', 'Reason', 'Action'],
      rows: interventions.map((row) => ({
        Facility: row.facility ?? '—',
        'Institution type': row.institution_type ?? '—',
        District: row.district ?? '—',
        Reason: row.reason ?? '—',
        Action: row.action ?? '—',
      })),
    },
  }
}

export function buildSupervisorDrilldowns(
  teamMembers: Array<Record<string, string | number>>,
  pendingApprovals: Array<Record<string, string>>,
  pipCandidates: Array<Record<string, string>>,
): Record<string, DashboardDrilldown> {
  const byStatus = (status: string) =>
    teamMembers.filter((m) => String(m.status) === status).map((row) => ({
      'Staff name': row.staff_name,
      'Tasks due': row.tasks_due,
      Completed: row.completed,
      '% Complete': `${row.percent}%`,
      Status: formatStatus(String(row.status)),
    }))

  return {
    total_staff: {
      id: 'total_staff',
      title: 'Team members',
      description: `${teamMembers.length} staff in your supervision scope`,
      columns: ['Staff name', 'Tasks due', 'Completed', '% Complete', 'Status'],
      rows: teamMembers.map((row) => ({
        'Staff name': row.staff_name,
        'Tasks due': row.tasks_due,
        Completed: row.completed,
        '% Complete': `${row.percent}%`,
        Status: formatStatus(String(row.status)),
      })),
    },
    on_track: {
      id: 'on_track',
      title: 'Team members on track',
      description: 'Staff at or above task completion expectations',
      columns: ['Staff name', 'Tasks due', 'Completed', '% Complete', 'Status'],
      rows: byStatus('on_track'),
    },
    at_risk: {
      id: 'at_risk',
      title: 'Team members at risk',
      description: 'Staff below 80% task completion',
      columns: ['Staff name', 'Tasks due', 'Completed', '% Complete', 'Status'],
      rows: byStatus('at_risk'),
    },
    off_track: {
      id: 'off_track',
      title: 'Team members off track',
      description: 'Staff with significant missed tasks',
      columns: ['Staff name', 'Tasks due', 'Completed', '% Complete', 'Status'],
      rows: byStatus('off_track'),
    },
    pending_approvals: {
      id: 'pending_approvals',
      title: 'Pending approvals',
      description: 'Items requiring your action',
      columns: ['Type', 'Staff name', 'Details', 'Date', 'Action'],
      rows: pendingApprovals.map((row) => ({
        Type: row.type,
        'Staff name': row.staff_name,
        Details: row.details,
        Date: row.date,
        Action: row.action,
      })),
    },
    pip_candidates: {
      id: 'pip_candidates',
      title: 'PIP candidates',
      description: 'Staff flagged for performance improvement',
      columns: ['Staff name', 'Reason', 'Action'],
      rows: pipCandidates.map((row) => ({
        'Staff name': row.staff_name,
        Reason: row.reason,
        Action: row.action,
      })),
    },
    task_completion: {
      id: 'task_completion',
      title: 'Team task completion detail',
      description: 'All team members and quarterly progress',
      columns: ['Staff name', 'Tasks due', 'Completed', '% Complete', 'Status'],
      rows: teamMembers.map((row) => ({
        'Staff name': row.staff_name,
        'Tasks due': row.tasks_due,
        Completed: row.completed,
        '% Complete': `${row.percent}%`,
        Status: formatStatus(String(row.status)),
      })),
    },
  }
}

export function buildDepartmentDrilldowns(
  teamPerformance: Array<Record<string, string | number>>,
  interventions: Array<Record<string, unknown>>,
): Record<string, DashboardDrilldown> {
  const mapTeams = (rows: typeof teamPerformance) =>
    rows.map((row) => ({
      'Team/Supervisor': row.team,
      Staff: row.staff,
      'Avg Task %': `${row.avg_task_percent}%`,
      Attendance: `${row.attendance}%`,
      Status: formatStatus(String(row.status)),
    }))

  const onTrack = teamPerformance.filter((t) => t.status === 'on_track')
  const atRisk = teamPerformance.filter((t) => t.status === 'at_risk')
  const offTrack = teamPerformance.filter((t) => t.status === 'off_track')

  return {
    total_teams: {
      id: 'total_teams',
      title: 'All teams',
      description: `${teamPerformance.length} supervisor teams in department`,
      columns: ['Team/Supervisor', 'Staff', 'Avg Task %', 'Attendance', 'Status'],
      rows: mapTeams(teamPerformance),
    },
    on_track: {
      id: 'on_track',
      title: 'Teams on track',
      description: `${onTrack.length} teams meeting targets`,
      columns: ['Team/Supervisor', 'Staff', 'Avg Task %', 'Attendance', 'Status'],
      rows: mapTeams(onTrack),
    },
    at_risk: {
      id: 'at_risk',
      title: 'Teams at risk',
      description: `${atRisk.length} teams need monitoring`,
      columns: ['Team/Supervisor', 'Staff', 'Avg Task %', 'Attendance', 'Status'],
      rows: mapTeams(atRisk),
    },
    off_track: {
      id: 'off_track',
      title: 'Teams off track',
      description: `${offTrack.length} teams requiring intervention`,
      columns: ['Team/Supervisor', 'Staff', 'Avg Task %', 'Attendance', 'Status'],
      rows: mapTeams(offTrack),
    },
    task_completion: {
      id: 'task_completion',
      title: 'Department task completion',
      description: 'Team performance contributing to department score',
      columns: ['Team/Supervisor', 'Staff', 'Avg Task %', 'Attendance', 'Status'],
      rows: mapTeams(onTrack),
    },
    interventions: {
      id: 'interventions',
      title: 'Intervention required',
      description: 'Teams flagged for department head action',
      columns: ['Team', 'Reason', 'Actions'],
      rows: interventions.map((row) => ({
        Team: String(row.team ?? '—'),
        Reason: String(row.reason ?? '—'),
        Actions: Array.isArray(row.actions) ? (row.actions as string[]).join(', ') : '—',
      })),
    },
  }
}

export function buildHealthWorkerDrilldowns(
  attendanceRows: Array<{
    month: string
    oos_attendance_percent: number
    hrm_summary_percent: number
    combined_percent: number
    target: number
    status: string
    oos_clock_events?: number
  }>,
  quarterlyTasks: Array<Record<string, string>>,
  tasksDue: Array<{ task: string; status: string }>,
  deadlines: Array<{ task: string; days_remaining: number }>,
): Record<string, DashboardDrilldown> {
  return {
    combined_attendance: {
      id: 'combined_attendance',
      title: 'My combined attendance',
      description: 'Monthly HRM + PMS combined rates',
      columns: ['Month', 'HRM summary', 'PMS OOS', 'Combined', 'Status'],
      rows: attendanceRows.map((row) => ({
        Month: row.month,
        'HRM summary': `${row.hrm_summary_percent}%`,
        'PMS OOS': `${row.oos_attendance_percent}%`,
        Combined: `${row.combined_percent}%`,
        Status: formatStatus(row.status),
      })),
    },
    oos_attendance: {
      id: 'oos_attendance',
      title: 'Out-of-station attendance',
      description: 'PMS GPS clock events by month',
      columns: ['Month', 'PMS OOS', 'Clock events', 'Combined', 'Status'],
      rows: attendanceRows.map((row) => ({
        Month: row.month,
        'PMS OOS': `${row.oos_attendance_percent}%`,
        'Clock events': row.oos_clock_events ?? 0,
        Combined: `${row.combined_percent}%`,
        Status: formatStatus(row.status),
      })),
    },
    hrm_attendance: {
      id: 'hrm_attendance',
      title: 'Duty station attendance (HRM)',
      description: 'HRM Attend summary rates by month',
      columns: ['Month', 'HRM summary', 'PMS OOS', 'Combined', 'Status'],
      rows: attendanceRows.map((row) => ({
        Month: row.month,
        'HRM summary': `${row.hrm_summary_percent}%`,
        'PMS OOS': `${row.oos_attendance_percent}%`,
        Combined: `${row.combined_percent}%`,
        Status: formatStatus(row.status),
      })),
    },
    task_completion: {
      id: 'task_completion',
      title: 'Quarterly tasks',
      description: 'Your task list for the current quarter',
      columns: ['ID', 'Task description', 'Due date', 'Status', 'Action'],
      rows: quarterlyTasks.map((task) => ({
        ID: task.id,
        'Task description': task.description,
        'Due date': task.due_date,
        Status: task.status,
        Action: task.action,
      })),
    },
    tasks_due: {
      id: 'tasks_due',
      title: 'Tasks due this week',
      description: `${tasksDue.length} immediate focus items`,
      columns: ['Task', 'Status'],
      rows: tasksDue.map((item) => ({ Task: item.task, Status: item.status })),
    },
    deadlines: {
      id: 'deadlines',
      title: 'Upcoming deadlines',
      description: 'Due within the next 7 days',
      columns: ['Task', 'Days remaining'],
      rows: deadlines.map((item) => ({
        Task: item.task,
        'Days remaining': item.days_remaining,
      })),
    },
  }
}

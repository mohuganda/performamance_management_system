/** Normalize API records that may use PascalCase (Go default) or snake_case. */
export function field<T>(row: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) {
      return row[key] as T
    }
  }
  return undefined
}

export type LeaveTypeOption = {
  id: number
  name: string
  code: string
}

export function normalizeLeaveTypes(value: unknown): LeaveTypeOption[] {
  if (!Array.isArray(value)) return []
  return value
    .map((raw) => {
      const row = raw as Record<string, unknown>
      const id = Number(field<number>(row, 'id', 'ID'))
      const name = String(field<string>(row, 'name', 'Name') ?? '')
      const code = String(field<string>(row, 'code', 'Code') ?? '')
      if (!id || !name) return null
      return { id, name, code }
    })
    .filter((row): row is LeaveTypeOption => row !== null)
}

export function normalizeDepartments(value: unknown): { id: number; name: string }[] {
  if (!Array.isArray(value)) return []
  return value
    .map((raw) => {
      const row = raw as Record<string, unknown>
      const id = Number(field<number>(row, 'id', 'ID'))
      const name = String(field<string>(row, 'name', 'Name') ?? '')
      if (!id || !name) return null
      return { id, name }
    })
    .filter((row): row is { id: number; name: string } => row !== null)
}

export type SupervisorAssignment = {
  sequence: number
  supervisor_staff_id: number
  supervisor_name?: string
}

export function normalizeSupervisors(value: unknown): SupervisorAssignment[] {
  if (!Array.isArray(value)) return []
  const rows: SupervisorAssignment[] = []
  for (const raw of value) {
    const row = raw as Record<string, unknown>
    const supervisorStaffId = Number(field<number>(row, 'supervisor_staff_id', 'SupervisorStaffID'))
    const sequence = Number(field<number>(row, 'sequence', 'Sequence'))
    if (!supervisorStaffId || !sequence) continue
    const supervisorName = String(field<string>(row, 'supervisor_name', 'SupervisorName') ?? '')
    rows.push({
      sequence,
      supervisor_staff_id: supervisorStaffId,
      ...(supervisorName ? { supervisor_name: supervisorName } : {}),
    })
  }
  return rows
}

export function normalizeStaffList(value: unknown): StaffListRow[] {
  if (!Array.isArray(value)) return []
  const rows: StaffListRow[] = []
  for (const raw of value) {
    const row = raw as Record<string, unknown>
    const staffId = Number(field<number>(row, 'staff_id', 'StaffID'))
    if (!staffId) continue
    rows.push({
      staff_id: staffId,
      ihris_pid: String(field<string>(row, 'ihris_pid', 'IhrisPID') ?? ''),
      name: String(field<string>(row, 'name', 'Name') ?? ''),
      email: String(field<string>(row, 'email', 'Email') ?? ''),
      mobile: String(field<string>(row, 'mobile', 'Mobile') ?? ''),
      job_title: String(field<string>(row, 'job_title', 'JobTitle') ?? ''),
      facility_name: String(field<string>(row, 'facility_name', 'FacilityName') ?? ''),
      department_name: String(field<string>(row, 'department_name', 'DepartmentName') ?? ''),
      hr_department_id: field<number>(row, 'hr_department_id', 'HrDepartmentID'),
      hr_department_name: String(field<string>(row, 'hr_department_name', 'HrDepartment') ?? '') || undefined,
      has_supervisor: Boolean(field<boolean>(row, 'has_supervisor', 'HasSupervisor')),
      supervisor_name: String(field<string>(row, 'supervisor_name', 'SupervisorName') ?? '') || undefined,
      supervisors: normalizeSupervisors(row.supervisors ?? row.Supervisors),
      cadre: String(field<string>(row, 'cadre', 'Cadre') ?? '') || undefined,
      region: String(field<string>(row, 'region', 'Region') ?? '') || undefined,
      ihris_last_sync_at: String(field<string>(row, 'ihris_last_sync_at', 'IhrisLastSyncAt') ?? '') || undefined,
    })
  }
  return rows
}

export type StaffListRow = {
  staff_id: number
  ihris_pid: string
  name: string
  email: string
  mobile: string
  job_title: string
  facility_name: string
  department_name: string
  hr_department_id?: number
  hr_department_name?: string
  has_supervisor: boolean
  supervisor_name?: string
  supervisors?: SupervisorAssignment[]
  cadre?: string
  region?: string
  ihris_last_sync_at?: string
}

export function normalizeKpiCategories(value: unknown): { id: number; category_name: string }[] {
  if (!Array.isArray(value)) return []
  return value
    .map((raw) => {
      const row = raw as Record<string, unknown>
      const id = Number(field<number>(row, 'id', 'ID'))
      const category_name = String(
        field<string>(row, 'category_name', 'CategoryName') ?? '',
      )
      if (!id || !category_name) return null
      return { id, category_name }
    })
    .filter((row): row is { id: number; category_name: string } => row !== null)
}

/** Maps legacy "Normal" to display label "Ordinary". */
export function kpiCategoryLabel(name: string): string {
  if (name === 'Normal') return 'Ordinary'
  return name
}

export function isOrdinaryKpiCategory(name: string): boolean {
  return name === 'Ordinary' || name === 'Normal'
}

export type SupervisionRow = {
  staff_id: number
  staff_name: string
  job_title: string
  facility_name: string
  has_supervisor: boolean
  supervisor_staff_id?: number
  supervisor_name?: string
}

export function normalizeSupervision(value: unknown): SupervisionRow[] {
  if (!Array.isArray(value)) return []
  const rows: SupervisionRow[] = []
  for (const raw of value) {
    const row = raw as Record<string, unknown>
    const staffId = Number(field<number>(row, 'staff_id', 'StaffID'))
    if (!staffId) continue
    rows.push({
      staff_id: staffId,
      staff_name: String(field<string>(row, 'staff_name', 'StaffName') ?? ''),
      job_title: String(field<string>(row, 'job_title', 'JobTitle') ?? ''),
      facility_name: String(field<string>(row, 'facility_name', 'FacilityName') ?? ''),
      has_supervisor: Boolean(field<boolean>(row, 'has_supervisor', 'HasSupervisor')),
      supervisor_staff_id: field<number>(row, 'supervisor_staff_id', 'SupervisorStaffID'),
      supervisor_name: String(field<string>(row, 'supervisor_name', 'SupervisorName') ?? '') || undefined,
    })
  }
  return rows
}

export type SupervisorCandidate = {
  staff_id: number
  name: string
  job_title: string
}

export function normalizeSupervisorCandidates(value: unknown): SupervisorCandidate[] {
  if (!Array.isArray(value)) return []
  return value
    .map((raw) => {
      const row = raw as Record<string, unknown>
      const staffId = Number(field<number>(row, 'staff_id', 'StaffID'))
      if (!staffId) return null
      const name = String(field<string>(row, 'name', 'Name') ?? '')
      return {
        staff_id: staffId,
        name,
        job_title: String(field<string>(row, 'job_title', 'JobTitle') ?? ''),
      }
    })
    .filter((row): row is SupervisorCandidate => row !== null)
}

import apiClient from '../client'
import { asArray } from '@/utils/asArray'
import { normalizeKpiCategories } from '@/utils/normalizeApi'
import { unwrapApiData } from '@/utils/unwrapApi'
import type { PaginatedResponse } from '@/types/pagination'
import { unwrapPaginated } from '@/types/pagination'

export type KpiRow = {
  id: number
  kpi_code: string
  short_name: string
  indicator_statement: string
  frequency: string
  computation_category: string
  subject_area_id?: number
  subject_area_name: string
  category_id: number
  category_name: string
  current_target?: number
  is_cumulative?: boolean
  status: boolean
  assignment_count: number
}

export type KpiAssignmentRow = {
  id: number
  kpi_id: number
  kpi_code: string
  kpi_name: string
  assignable_type: 'facility_type' | 'facility' | 'job' | 'department' | 'staff'
  facility_type_ref_id?: number
  facility_type_name?: string
  facility_id?: number
  facility_name?: string
  job_id?: number
  job_title?: string
  department_id?: number
  department_name?: string
  staff_id?: number
  staff_name?: string
  is_active: boolean
}

export type KpiAssignmentTargetOption = {
  id: number
  name: string
  subtitle?: string
  facility_type_name?: string
  facility_name?: string
  scope?: string
}

export type KpiAssignmentTargets = {
  facility_types: KpiAssignmentTargetOption[]
  facilities: KpiAssignmentTargetOption[]
  departments: KpiAssignmentTargetOption[]
  jobs: KpiAssignmentTargetOption[]
}

export type KpiPermissionInfo = {
  code: string
  name: string
  description: string
}

export const kpiAdminService = {
  permissions: async () => {
    const { data } = await apiClient.get('/admin/kpi/permissions')
    return data as { permissions: KpiPermissionInfo[]; default_roles: Record<string, string[]> }
  },
  subjectAreas: async () => {
    const { data } = await apiClient.get('/admin/kpi/subject-areas')
    return asArray<{ id: number; label: string }>(data)
  },
  categories: async () => {
    const { data } = await apiClient.get('/admin/kpi/categories')
    return normalizeKpiCategories(data)
  },
  nextKpiCode: async (categoryId: number): Promise<{ kpi_code: string }> => {
    const { data } = await apiClient.get('/admin/kpi/next-code', {
      params: { category_id: categoryId },
    })
    const payload = unwrapApiData<{ kpi_code?: string }>(data)
    return { kpi_code: payload.kpi_code ?? '' }
  },
  listKpis: async (params?: {
    search?: string
    subject_area?: number
    category_id?: number
    active_only?: boolean
    page?: number
    per_page?: number
  }): Promise<PaginatedResponse<KpiRow>> => {
    const { data } = await apiClient.get('/admin/kpi/kpis', { params })
    const page = unwrapPaginated<KpiRow>(data)
    return { ...page, data: asArray<KpiRow>(page.data) }
  },
  createKpi: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post('/admin/kpi/kpis', payload)
    return data
  },
  updateKpi: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.put(`/admin/kpi/kpis/${id}`, payload)
    return data
  },
  deactivateKpi: async (id: number) => {
    const { data } = await apiClient.delete(`/admin/kpi/kpis/${id}`)
    return data
  },
  listAssignments: async (params?: {
    assignable_type?: string
    kpi_id?: number
    search?: string
    page?: number
    per_page?: number
  }): Promise<PaginatedResponse<KpiAssignmentRow>> => {
    const { data } = await apiClient.get('/admin/kpi/assignments', { params })
    const page = unwrapPaginated<KpiAssignmentRow>(data)
    return { ...page, data: asArray<KpiAssignmentRow>(page.data) }
  },
  createAssignment: async (payload: {
    kpi_id?: number
    kpi_ids?: number[]
    assignable_type: string
    facility_type_ref_id?: number
    facility_id?: number
    job_id?: number
    department_id?: number
    staff_id?: number
  }) => {
    const { data } = await apiClient.post('/admin/kpi/assignments', payload)
    return data as
      | { created: number; reactivated: number; failed: number; errors?: string[] }
      | Record<string, unknown>
  },
  removeAssignment: async (id: number) => {
    const { data } = await apiClient.delete(`/admin/kpi/assignments/${id}`)
    return data
  },
  listJobs: async () => {
    const { data } = await apiClient.get('/admin/kpi/jobs')
    return asArray<{ id: number; job_title: string; external_job_id: string }>(data)
  },
  listDepartments: async () => {
    const { data } = await apiClient.get('/admin/kpi/departments')
    return asArray<{ id: number; name: string }>(data)
  },
  assignmentTargets: async (): Promise<KpiAssignmentTargets> => {
    const { data } = await apiClient.get('/admin/kpi/assignment-targets')
    return data as KpiAssignmentTargets
  },
  searchStaff: async (search?: string) => {
    const { data } = await apiClient.get('/admin/kpi/staff-search', { params: { search } })
    return asArray<{
      staff_id: number
      name: string
      email: string
      facility_name?: string
      facility_type_name?: string
      department_name?: string
      job_title?: string
    }>(data)
  },
}

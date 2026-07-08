import apiClient from '../client'
import { asArray } from '@/utils/asArray'
import { normalizeKpiCategories } from '@/utils/normalizeApi'
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
  assignable_type: 'job' | 'department' | 'staff'
  job_id?: number
  job_title?: string
  department_id?: number
  department_name?: string
  staff_id?: number
  staff_name?: string
  is_active: boolean
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
    kpi_id: number
    assignable_type: string
    job_id?: number
    department_id?: number
    staff_id?: number
  }) => {
    const { data } = await apiClient.post('/admin/kpi/assignments', payload)
    return data
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
  searchStaff: async (search?: string) => {
    const { data } = await apiClient.get('/admin/kpi/staff-search', { params: { search } })
    return asArray<{ staff_id: number; name: string; email: string }>(data)
  },
}

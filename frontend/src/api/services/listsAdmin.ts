import apiClient from '../client'
import type { PaginatedResponse } from '@/types/pagination'
import { unwrapPaginated } from '@/types/pagination'

export type ListsSummary = {
  regions: number
  districts: number
  facilities: number
  departments: number
  job_titles: number
  oos_reasons: number
}

export type RegionListRow = {
  id: number
  code: string
  name: string
  external_system_id?: string | null
  iso_code?: string | null
  is_active: boolean
  district_count: number
}

export type DistrictListRow = {
  id: number
  code: string
  name: string
  region: string
  region_id?: number | null
  region_name: string
  ihris_district_id?: string | null
  iso_code: string
  is_active: boolean
  facility_count: number
}

export type FacilityListRow = {
  id: number
  ihris_facility_id: string
  name: string
  district_ref_id?: number | null
  district_name: string
  region_id?: number | null
  region_name: string
  latitude?: number | null
  longitude?: number | null
  is_active: boolean
}

export type DepartmentListRow = {
  id: number
  name: string
  external_system_id: string
  facility_id?: number | null
  facility_name?: string
}

export type JobTitleListRow = {
  id: number
  external_job_id: string
  job_title: string
}

export type OosReasonListRow = {
  id: number
  reason: string
  is_active: boolean
}

export type RegionOption = { id: number; name: string; code: string }
export type DistrictOption = { id: number; name: string; code: string; region_id?: number | null }

type ListParams = {
  search?: string
  region_id?: number
  district_id?: number
  facility_id?: number
  page?: number
  per_page?: number
}

export const listsAdminService = {
  summary: async (): Promise<ListsSummary> => {
    const { data } = await apiClient.get('/admin/lists/summary')
    return data
  },
  listRegions: async (params: ListParams = {}) => {
    const { data } = await apiClient.get('/admin/lists/regions', { params })
    return unwrapPaginated<RegionListRow>(data) as PaginatedResponse<RegionListRow>
  },
  listDistricts: async (params: ListParams = {}) => {
    const { data } = await apiClient.get('/admin/lists/districts', { params })
    return unwrapPaginated<DistrictListRow>(data) as PaginatedResponse<DistrictListRow>
  },
  listFacilities: async (params: ListParams = {}) => {
    const { data } = await apiClient.get('/admin/lists/facilities', { params })
    return unwrapPaginated<FacilityListRow>(data) as PaginatedResponse<FacilityListRow>
  },
  listDepartments: async (params: ListParams = {}) => {
    const { data } = await apiClient.get('/admin/lists/departments', { params })
    return unwrapPaginated<DepartmentListRow>(data) as PaginatedResponse<DepartmentListRow>
  },
  listJobTitles: async (params: ListParams = {}) => {
    const { data } = await apiClient.get('/admin/lists/job-titles', { params })
    return unwrapPaginated<JobTitleListRow>(data) as PaginatedResponse<JobTitleListRow>
  },
  listOosReasons: async (params: ListParams = {}) => {
    const { data } = await apiClient.get('/admin/lists/oos-reasons', { params })
    return unwrapPaginated<OosReasonListRow>(data) as PaginatedResponse<OosReasonListRow>
  },
  regionOptions: async (): Promise<RegionOption[]> => {
    const { data } = await apiClient.get('/admin/lists/region-options')
    return data
  },
  districtOptions: async (): Promise<DistrictOption[]> => {
    const { data } = await apiClient.get('/admin/lists/district-options')
    return data
  },
  updateRegion: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.put(`/admin/lists/regions/${id}`, payload)
    return data
  },
  updateDistrict: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.put(`/admin/lists/districts/${id}`, payload)
    return data
  },
  updateFacility: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.put(`/admin/lists/facilities/${id}`, payload)
    return data
  },
  updateDepartment: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.put(`/admin/lists/departments/${id}`, payload)
    return data
  },
  updateJobTitle: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.put(`/admin/lists/job-titles/${id}`, payload)
    return data
  },
  createDepartment: async (payload: { name: string; external_system_id?: string }) => {
    const { data } = await apiClient.post('/admin/lists/departments', payload)
    return data as DepartmentListRow
  },
  createJobTitle: async (payload: { job_title: string; external_job_id?: string }) => {
    const { data } = await apiClient.post('/admin/lists/job-titles', payload)
    return data as JobTitleListRow
  },
  updateOosReason: async (id: number, payload: { reason?: string; is_active?: boolean }) => {
    const { data } = await apiClient.put(`/admin/lists/oos-reasons/${id}`, payload)
    return data
  },
  createOosReason: async (payload: { reason: string }) => {
    const { data } = await apiClient.post('/admin/lists/oos-reasons', payload)
    return data as OosReasonListRow
  },
}

import apiClient from '../client'
import type { PaginatedResponse } from '@/types/pagination'
import { unwrapPaginated } from '@/types/pagination'

export type RoleCategory = 'operational' | 'executive' | 'administrative' | 'system'

export type RbacRole = {
  id: number
  code: string
  name: string
  description?: string
  category: RoleCategory
  hierarchy_level: number
  is_system: boolean
  is_active: boolean
}

export type RbacPermission = {
  id: number
  code: string
  name: string
  module: string
  action: string
}

export type RbacUserRow = {
  id: number
  name: string
  email: string
  is_active: boolean
  is_super_admin: boolean
  staff_id?: number
  primary_role: string
  roles: string[]
  account_category: RoleCategory
  last_login_at?: string
  created_at: string
  scope_level?: string
  scope_district_id?: string
  scope_facility_id?: number
  scope_facility_name?: string
  scope_district_name?: string
}

export type ScopeOptions = {
  districts: Array<{ id: string; name: string }>
  facilities: Array<{ id: number; name: string }>
  levels: Array<{ value: string; label: string; description: string }>
}

export type AuditLogRow = {
  id: number
  actor_user_id?: number
  actor_name: string
  actor_email?: string
  module: string
  action: string
  entity_type?: string
  entity_id?: number
  summary: string
  metadata?: string
  is_dangerous: boolean
  is_recoverable: boolean
  is_recovered: boolean
  recovered_at?: string
  ip_address?: string
  created_at: string
}

export const ROLE_CATEGORY_LABELS: Record<RoleCategory, string> = {
  operational: 'Operational',
  executive: 'Executive Decision Maker',
  administrative: 'Administrative',
  system: 'System',
}

export const rbacAdminService = {
  listRoles: async (category?: string): Promise<RbacRole[]> => {
    const { data } = await apiClient.get('/admin/rbac/roles', {
      params: category ? { category } : undefined,
    })
    return Array.isArray(data) ? data : []
  },

  listPermissions: async (): Promise<RbacPermission[]> => {
    const { data } = await apiClient.get('/admin/rbac/permissions')
    return Array.isArray(data) ? data : []
  },

  listUsers: async (params?: {
    search?: string
    role_code?: string
    category?: string
    is_active?: string
    scope_district?: string
    page?: number
    per_page?: number
  }): Promise<PaginatedResponse<RbacUserRow>> => {
    const { data } = await apiClient.get('/admin/rbac/users', { params })
    return unwrapPaginated<RbacUserRow>(data)
  },

  createUser: async (payload: {
    name: string
    email: string
    password: string
    staff_id?: number
    role_codes: string[]
    scope_level?: string
    scope_district_id?: string
    scope_facility_id?: number
  }) => {
    const { data } = await apiClient.post('/admin/rbac/users', payload)
    return data as RbacUserRow
  },

  updateUser: async (
    id: number,
    payload: {
      name?: string
      is_active?: boolean
      scope_level?: string
      scope_district_id?: string
      scope_facility_id?: number
    },
  ) => {
    const { data } = await apiClient.patch(`/admin/rbac/users/${id}`, payload)
    return data as RbacUserRow
  },

  assignRole: async (userId: number, roleCode: string) => {
    const { data } = await apiClient.post(`/admin/rbac/users/${userId}/roles`, {
      role_code: roleCode,
    })
    return data
  },

  revokeRole: async (userId: number, roleCode: string) => {
    const { data } = await apiClient.delete(`/admin/rbac/users/${userId}/roles`, {
      params: { role_code: roleCode },
    })
    return data
  },

  listScopeOptions: async (): Promise<ScopeOptions> => {
    const { data } = await apiClient.get('/admin/rbac/scope-options')
    return data as ScopeOptions
  },

  listAuditLogs: async (params?: {
    search?: string
    module?: string
    action?: string
    dangerous?: string
    recoverable?: string
    recovered?: string
    page?: number
    per_page?: number
  }): Promise<PaginatedResponse<AuditLogRow>> => {
    const { data } = await apiClient.get('/admin/rbac/audit-logs', { params })
    return unwrapPaginated<AuditLogRow>(data)
  },

  recoverAuditLog: async (id: number) => {
    const { data } = await apiClient.post(`/admin/rbac/audit-logs/${id}/recover`)
    return data
  },
}

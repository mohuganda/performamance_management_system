import apiClient from '../client'
import type { PaginatedResponse } from '@/types/pagination'
import { unwrapPaginated } from '@/types/pagination'
import { asArray } from '@/utils/asArray'
import { normalizePermissionCodes, normalizePermissions } from '@/utils/normalizeApi'
import { unwrapApiData } from '@/utils/unwrapApi'

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

export type ScopeAssignmentInput = {
  scope_type: 'region' | 'district' | 'facility'
  ref_id?: number
  ref_code?: string
  label?: string
}

export type RbacUserRow = {
  id: number
  name: string
  email: string
  is_active: boolean
  is_super_admin: boolean
  staff_id?: number
  staff_name?: string
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
  scope_assignments?: ScopeAssignmentInput[]
  totp_enabled?: boolean
}

export type ScopeOptions = {
  regions: Array<{ id: number; code: string; name: string }>
  districts: Array<{
    id: string
    ref_id: number
    code: string
    name: string
    region_id?: number
  }>
  facilities: Array<{
    id: number
    name: string
    district_ref_id?: number
    district_id?: string
    district_name?: string
    region_id?: number
  }>
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
    return asArray<RbacRole>(data)
  },

  listPermissions: async (): Promise<RbacPermission[]> => {
    const { data } = await apiClient.get('/admin/rbac/permissions')
    return normalizePermissions(unwrapApiData(data))
  },

  listRolePermissions: async (roleCode: string): Promise<string[]> => {
    const { data } = await apiClient.get(`/admin/rbac/roles/${encodeURIComponent(roleCode)}/permissions`)
    return normalizePermissionCodes(data)
  },

  grantRolePermission: async (roleCode: string, permissionCode: string) => {
    const { data } = await apiClient.post('/admin/rbac/grant-permission', {
      role_code: roleCode,
      permission_code: permissionCode,
    })
    return data
  },

  revokeRolePermission: async (roleCode: string, permissionCode: string) => {
    const { data } = await apiClient.post('/admin/rbac/revoke-permission', {
      role_code: roleCode,
      permission_code: permissionCode,
    })
    return data
  },

  listUserPermissions: async (userId: number): Promise<string[]> => {
    const { data } = await apiClient.get(`/admin/rbac/users/${userId}/permissions`)
    return normalizePermissionCodes(data)
  },

  grantUserPermission: async (userId: number, permissionCode: string) => {
    const { data } = await apiClient.post(`/admin/rbac/users/${userId}/permissions`, {
      permission_code: permissionCode,
    })
    return data
  },

  revokeUserPermission: async (userId: number, permissionCode: string) => {
    const { data } = await apiClient.delete(`/admin/rbac/users/${userId}/permissions`, {
      params: { permission_code: permissionCode },
    })
    return data
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
    scope_assignments?: ScopeAssignmentInput[]
  }) => {
    const { data } = await apiClient.post('/admin/rbac/users', payload)
    return data as RbacUserRow
  },

  updateUser: async (
    id: number,
    payload: {
      name?: string
      is_active?: boolean
      staff_id?: number
      unlink_staff?: boolean
      scope_level?: string
      scope_district_id?: string
      scope_facility_id?: number
      scope_assignments?: ScopeAssignmentInput[]
    },
  ) => {
    const { data } = await apiClient.patch(`/admin/rbac/users/${id}`, payload)
    return data as RbacUserRow
  },

  resetAuthenticator: async (userId: number) => {
    const { data } = await apiClient.post(`/admin/rbac/users/${userId}/reset-authenticator`)
    return data as { message: string }
  },

  linkStaffByEmail: async (userId: number) => {
    const { data } = await apiClient.post(`/admin/rbac/users/${userId}/link-staff-by-email`)
    return data as RbacUserRow
  },

  sendActivation: async (userId: number) => {
    const { data } = await apiClient.post(`/admin/rbac/users/${userId}/send-activation`)
    return data as { message: string }
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

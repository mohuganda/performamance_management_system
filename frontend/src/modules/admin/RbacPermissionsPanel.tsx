import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, Switch, Typography } from '@material-tailwind/react'
import {
  rbacAdminService,
  type RbacPermission,
  type RbacRole,
} from '@/api/services/rbacAdmin'
import { mt } from '@/utils/mt'
import { cn } from '@/utils/cn'

type RolePermissionsPanelProps = {
  roles: RbacRole[]
  permissions: RbacPermission[]
  selectedRoleCode: string
  onSelectRole: (code: string) => void
}

export function RolePermissionsPanel({
  roles,
  permissions,
  selectedRoleCode,
  onSelectRole,
}: RolePermissionsPanelProps) {
  const queryClient = useQueryClient()

  const rolePermsQuery = useQuery({
    queryKey: ['admin', 'rbac', 'role-permissions', selectedRoleCode],
    queryFn: () => rbacAdminService.listRolePermissions(selectedRoleCode),
    enabled: Boolean(selectedRoleCode),
  })

  const granted = useMemo(() => new Set(rolePermsQuery.data ?? []), [rolePermsQuery.data])

  const grouped = useMemo(() => {
    const map = new Map<string, RbacPermission[]>()
    for (const perm of permissions) {
      const module = perm.module || 'other'
      const list = map.get(module) ?? []
      list.push(perm)
      map.set(module, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [permissions])

  const toggleMutation = useMutation({
    mutationFn: async ({ code, enable }: { code: string; enable: boolean }) => {
      if (enable) {
        await rbacAdminService.grantRolePermission(selectedRoleCode, code)
      } else {
        await rbacAdminService.revokeRolePermission(selectedRoleCode, code)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rbac', 'role-permissions', selectedRoleCode] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'rbac', 'audit'] })
    },
  })

  const selectedRole = roles.find((r) => r.code === selectedRoleCode)

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card {...mt} className="rounded-sm border border-moh-green/15 p-4 lg:col-span-4">
        <Typography {...mt} className="mb-3 text-sm font-bold uppercase text-moh-green">
          Roles
        </Typography>
        <p className="mb-3 text-xs text-gray-500">Select a role to manage its permissions.</p>
        <ul className="space-y-1">
          {roles.map((role) => (
            <li key={role.id}>
              <button
                type="button"
                onClick={() => onSelectRole(role.code)}
                className={cn(
                  'w-full rounded-sm border px-3 py-2 text-left text-sm transition',
                  selectedRoleCode === role.code
                    ? 'border-moh-green bg-moh-green/5 font-medium text-moh-green'
                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50',
                )}
              >
                <span className="block">{role.name}</span>
                <span className="text-xs text-gray-500">{role.code}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card {...mt} className="rounded-sm border border-moh-green/15 p-4 lg:col-span-8">
        <Typography {...mt} className="mb-1 text-sm font-bold uppercase text-moh-green">
          Permissions for {selectedRole?.name ?? selectedRoleCode}
        </Typography>
        <p className="mb-4 text-xs text-gray-500">
          Toggle permissions granted to this role. Users inherit permissions from all assigned roles.
        </p>

        {permissions.length === 0 ? (
          <p className="text-sm text-gray-500">No permissions defined in the system.</p>
        ) : (
          <div className="max-h-[32rem] space-y-5 overflow-y-auto pr-1">
            {grouped.map(([module, modulePerms]) => (
              <div key={module}>
                <Typography {...mt} className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                  {module}
                </Typography>
                <div className="space-y-2">
                  {modulePerms.map((perm) => {
                    const enabled = granted.has(perm.code)
                    return (
                      <div
                        key={perm.id}
                        className="flex items-start justify-between gap-3 rounded-sm border border-gray-100 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ui-text">{perm.name}</p>
                          <p className="font-mono text-xs text-gray-500">{perm.code}</p>
                        </div>
                        <Switch
                          {...mt}
                          checked={enabled}
                          disabled={toggleMutation.isPending || rolePermsQuery.isLoading}
                          onChange={(e) =>
                            toggleMutation.mutate({ code: perm.code, enable: e.target.checked })
                          }
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

type UserPermissionsPanelProps = {
  userId: number
  permissions: RbacPermission[]
  rolePermissionCodes: string[]
}

export function UserPermissionsPanel({
  userId,
  permissions,
  rolePermissionCodes,
}: UserPermissionsPanelProps) {
  const queryClient = useQueryClient()

  const userPermsQuery = useQuery({
    queryKey: ['admin', 'rbac', 'user-permissions', userId],
    queryFn: () => rbacAdminService.listUserPermissions(userId),
  })

  const direct = useMemo(() => new Set(userPermsQuery.data ?? []), [userPermsQuery.data])
  const fromRoles = useMemo(() => new Set(rolePermissionCodes), [rolePermissionCodes])

  const toggleMutation = useMutation({
    mutationFn: async ({ code, enable }: { code: string; enable: boolean }) => {
      if (enable) {
        await rbacAdminService.grantUserPermission(userId, code)
      } else {
        await rbacAdminService.revokeUserPermission(userId, code)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rbac', 'user-permissions', userId] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'rbac', 'audit'] })
    },
  })

  const grouped = useMemo(() => {
    const map = new Map<string, RbacPermission[]>()
    for (const perm of permissions) {
      const module = perm.module || 'other'
      const list = map.get(module) ?? []
      list.push(perm)
      map.set(module, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [permissions])

  return (
    <div className="space-y-3 rounded-sm border border-gray-100 bg-white p-3">
      <Typography {...mt} className="text-xs font-bold uppercase text-gray-500">
        Direct permission grants
      </Typography>
      <p className="text-xs text-gray-500">
        Extra permissions for this user only (in addition to role permissions). Inherited role
        permissions are shown as on but disabled.
      </p>
      <div className="max-h-64 space-y-4 overflow-y-auto">
        {grouped.map(([module, modulePerms]) => (
          <div key={module}>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">{module}</p>
            <div className="space-y-1">
              {modulePerms.map((perm) => {
                const inherited = fromRoles.has(perm.code)
                const directGrant = direct.has(perm.code)
                const checked = inherited || directGrant
                return (
                  <div
                    key={perm.id}
                    className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{perm.name}</p>
                      <p className="truncate font-mono text-[10px] text-gray-400">{perm.code}</p>
                    </div>
                    <Switch
                      {...mt}
                      checked={checked}
                      disabled={inherited || toggleMutation.isPending || userPermsQuery.isLoading}
                      onChange={(e) =>
                        toggleMutation.mutate({ code: perm.code, enable: e.target.checked })
                      }
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

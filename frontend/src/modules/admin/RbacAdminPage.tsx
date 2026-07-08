import { useMemo, useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Chip,
  Input,
  Switch,
  Typography,
} from '@material-tailwind/react'
import { Select, Option } from '@/components/molecules/MtSelect'
import {
  AlertTriangle,
  Crown,
  History,
  RotateCcw,
  Shield,
  UserCog,
  Users,
} from 'lucide-react'
import {
  rbacAdminService,
  ROLE_CATEGORY_LABELS,
  type AuditLogRow,
  type RbacRole,
  type RbacUserRow,
  type RoleCategory,
  type ScopeAssignmentInput,
  type ScopeOptions,
} from '@/api/services/rbacAdmin'
import { PageHeader } from '@/components/organisms/PageHeader'
import { QueryState } from '@/components/organisms/QueryState'
import { ServerPaginatedTable } from '@/components/organisms/ServerPaginatedTable'
import { RolePermissionsPanel, UserPermissionsPanel } from '@/modules/admin/RbacPermissionsPanel'
import { SegmentedTabs } from '@/components/molecules/SegmentedTabs'
import { useAdminPageSize } from '@/hooks/useAdminPageSize'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { mt } from '@/utils/mt'
import { cn } from '@/utils/cn'

type TabKey = 'users' | 'executive' | 'roles' | 'audit'

const CATEGORY_COLORS: Record<RoleCategory, string> = {
  operational: 'bg-slate-100 text-slate-700',
  executive: 'bg-amber-50 text-amber-900 border border-amber-200',
  administrative: 'bg-blue-50 text-blue-900',
  system: 'bg-purple-50 text-purple-900',
}

function CategoryBadge({ category }: { category: RoleCategory }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        CATEGORY_COLORS[category] ?? CATEGORY_COLORS.operational,
      )}
    >
      {ROLE_CATEGORY_LABELS[category] ?? category}
    </span>
  )
}

function formatScopeLabel(row: RbacUserRow) {
  if (row.scope_level === 'national') return 'National (MoH)'
  const parts: string[] = []
  const assignments = row.scope_assignments ?? []
  const regions = assignments.filter((a) => a.scope_type === 'region')
  const districts = assignments.filter((a) => a.scope_type === 'district')
  const facilities = assignments.filter((a) => a.scope_type === 'facility')
  if (regions.length) {
    parts.push(`Region · ${regions.map((a) => a.label ?? a.ref_code ?? a.ref_id).join(', ')}`)
  }
  if (districts.length) {
    parts.push(`District · ${districts.map((a) => a.label ?? a.ref_code ?? a.ref_id).join(', ')}`)
  }
  if (facilities.length) {
    parts.push(`Facility · ${facilities.map((a) => a.label ?? a.ref_id).join(', ')}`)
  }
  if (parts.length) return parts.join(' · ')
  if (row.scope_level === 'region') return 'Region scope'
  if (row.scope_level === 'district' && row.scope_district_name) {
    return `District · ${row.scope_district_name}`
  }
  if (row.scope_level === 'facility' && row.scope_facility_name) {
    return `Facility · ${row.scope_facility_name}`
  }
  if (row.scope_district_name) return `District · ${row.scope_district_name}`
  if (row.scope_facility_name) return `Facility · ${row.scope_facility_name}`
  return 'Staff-linked'
}

type ScopeFormState = {
  scope_level: string
  region_ids: number[]
  district_ref_ids: number[]
  facility_ids: number[]
}

const emptyScopeForm = (): ScopeFormState => ({
  scope_level: 'staff',
  region_ids: [],
  district_ref_ids: [],
  facility_ids: [],
})

function scopeFormFromUser(row: RbacUserRow): ScopeFormState {
  const form = emptyScopeForm()
  form.scope_level = row.scope_level || 'staff'
  for (const item of row.scope_assignments ?? []) {
    if (item.scope_type === 'region' && item.ref_id) form.region_ids.push(item.ref_id)
    if (item.scope_type === 'district' && item.ref_id) form.district_ref_ids.push(item.ref_id)
    if (item.scope_type === 'facility' && item.ref_id) form.facility_ids.push(item.ref_id)
  }
  return form
}

function buildScopeAssignments(form: ScopeFormState, options?: ScopeOptions): ScopeAssignmentInput[] {
  const out: ScopeAssignmentInput[] = []
  for (const id of form.region_ids) {
    const region = options?.regions.find((r) => r.id === id)
    out.push({
      scope_type: 'region',
      ref_id: id,
      ref_code: region?.code,
      label: region?.name,
    })
  }
  for (const id of form.district_ref_ids) {
    const district = options?.districts.find((d) => d.ref_id === id)
    out.push({
      scope_type: 'district',
      ref_id: id,
      ref_code: district?.id ?? district?.code,
      label: district?.name,
    })
  }
  for (const id of form.facility_ids) {
    const facility = options?.facilities.find((f) => f.id === id)
    out.push({
      scope_type: 'facility',
      ref_id: id,
      label: facility?.name,
    })
  }
  return out
}

function formatDate(value?: string) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

export function RbacAdminPage() {
  const queryClient = useQueryClient()
  const pageSize = useAdminPageSize()
  const [tab, setTab] = useState<TabKey>('users')
  const [userSearch, setUserSearch] = useState('')
  const debouncedUserSearch = useDebouncedValue(userSearch, 400)
  const [userRoleFilter, setUserRoleFilter] = useState('')
  const [userScopeFilter, setUserScopeFilter] = useState('')
  const [userActiveFilter, setUserActiveFilter] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [auditSearch, setAuditSearch] = useState('')
  const debouncedAuditSearch = useDebouncedValue(auditSearch, 400)
  const [auditDangerous, setAuditDangerous] = useState('')
  const [auditRecovered, setAuditRecovered] = useState('false')
  const [auditPage, setAuditPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [manageUser, setManageUser] = useState<RbacUserRow | null>(null)
  const [assignRoleCode, setAssignRoleCode] = useState('')
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role_codes: 'staff',
    ...emptyScopeForm(),
  })
  const [manageScope, setManageScope] = useState<ScopeFormState>(emptyScopeForm())
  const [selectedRoleCode, setSelectedRoleCode] = useState('admin')

  const rolesQuery = useQuery({
    queryKey: ['admin', 'rbac', 'roles'],
    queryFn: () => rbacAdminService.listRoles(),
    enabled: tab === 'users' || tab === 'executive' || tab === 'roles' || createOpen || !!manageUser,
    staleTime: 60_000,
  })

  const executiveRolesQuery = useQuery({
    queryKey: ['admin', 'rbac', 'roles', 'executive'],
    queryFn: () => rbacAdminService.listRoles('executive'),
    enabled: tab === 'executive',
    staleTime: 60_000,
  })

  const permsQuery = useQuery({
    queryKey: ['admin', 'rbac', 'permissions'],
    queryFn: () => rbacAdminService.listPermissions(),
    enabled: tab === 'roles' || !!manageUser,
    staleTime: 120_000,
  })

  const scopeOptionsQuery = useQuery({
    queryKey: ['admin', 'rbac', 'scope-options'],
    queryFn: () => rbacAdminService.listScopeOptions(),
    enabled: tab === 'users' || tab === 'executive' || createOpen || !!manageUser,
    staleTime: 120_000,
  })

  const usersQuery = useQuery({
    queryKey: [
      'admin',
      'rbac',
      'users',
      tab,
      debouncedUserSearch,
      userRoleFilter,
      userActiveFilter,
      userScopeFilter,
      userPage,
      pageSize,
    ],
    queryFn: () =>
      rbacAdminService.listUsers({
        search: debouncedUserSearch || undefined,
        role_code: userRoleFilter || undefined,
        category: tab === 'executive' ? 'executive' : undefined,
        is_active: userActiveFilter || undefined,
        scope_district: userScopeFilter || undefined,
        page: userPage,
        per_page: pageSize,
      }),
    enabled: tab === 'users' || tab === 'executive',
  })

  const auditQuery = useQuery({
    queryKey: ['admin', 'rbac', 'audit', debouncedAuditSearch, auditDangerous, auditRecovered, auditPage, pageSize],
    queryFn: () =>
      rbacAdminService.listAuditLogs({
        search: debouncedAuditSearch || undefined,
        module: 'rbac',
        dangerous: auditDangerous || undefined,
        recovered: auditRecovered || undefined,
        page: auditPage,
        per_page: pageSize,
      }),
    enabled: tab === 'audit',
  })

  const manageRolePermsQuery = useQuery({
    queryKey: ['admin', 'rbac', 'manage-role-perms', manageUser?.id, manageUser?.roles],
    queryFn: async () => {
      if (!manageUser?.roles?.length) return []
      const sets = await Promise.all(
        manageUser.roles.map((roleCode) => rbacAdminService.listRolePermissions(roleCode)),
      )
      return [...new Set(sets.flat())]
    },
    enabled: !!manageUser,
  })

  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'rbac', 'users'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'rbac', 'audit'] })
  }

  const createMutation = useMutation({
    mutationFn: () =>
      rbacAdminService.createUser({
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        role_codes: createForm.role_codes.split(',').map((r) => r.trim()).filter(Boolean),
        scope_level: createForm.scope_level || undefined,
        scope_assignments: buildScopeAssignments(createForm, scopeOptionsQuery.data),
      }),
    onSuccess: () => {
      invalidateUsers()
      setCreateOpen(false)
      setCreateForm({
        name: '',
        email: '',
        password: '',
        role_codes: 'staff',
        ...emptyScopeForm(),
      })
    },
  })

  const updateScopeMutation = useMutation({
    mutationFn: () =>
      rbacAdminService.updateUser(manageUser!.id, {
        scope_level: manageScope.scope_level,
        scope_assignments: buildScopeAssignments(manageScope, scopeOptionsQuery.data),
      }),
    onSuccess: () => {
      invalidateUsers()
      usersQuery.refetch()
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      rbacAdminService.updateUser(id, { is_active }),
    onSuccess: invalidateUsers,
  })

  const assignMutation = useMutation({
    mutationFn: () => rbacAdminService.assignRole(manageUser!.id, assignRoleCode),
    onSuccess: () => {
      invalidateUsers()
      setAssignRoleCode('')
      usersQuery.refetch()
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (roleCode: string) => rbacAdminService.revokeRole(manageUser!.id, roleCode),
    onSuccess: () => {
      invalidateUsers()
      usersQuery.refetch()
    },
  })

  const recoverMutation = useMutation({
    mutationFn: (id: number) => rbacAdminService.recoverAuditLog(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rbac', 'audit'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'rbac', 'users'] })
    },
  })

  useEffect(() => {
    setUserPage(1)
  }, [debouncedUserSearch, userRoleFilter, userActiveFilter, userScopeFilter, tab])

  useEffect(() => {
    setAuditPage(1)
  }, [debouncedAuditSearch, auditDangerous, auditRecovered])

  const scopeOptions = scopeOptionsQuery.data
  const roles = rolesQuery.data ?? []
  const permissions = permsQuery.data ?? []

  useEffect(() => {
    if (roles.length > 0 && !roles.some((r) => r.code === selectedRoleCode)) {
      setSelectedRoleCode(roles.find((r) => r.code === 'admin')?.code ?? roles[0].code)
    }
  }, [roles, selectedRoleCode])

  const executiveRoles = executiveRolesQuery.data ?? []
  const users = usersQuery.data?.data ?? []
  const userPagination = usersQuery.data ?? { total: 0, page: 1, per_page: pageSize, total_pages: 1 }
  const auditRows = auditQuery.data?.data ?? []
  const auditPagination = auditQuery.data ?? { total: 0, page: 1, per_page: pageSize, total_pages: 1 }

  const rolesByCode = useMemo(() => {
    const map = new Map<string, RbacRole>()
    roles.forEach((r) => map.set(r.code, r))
    return map
  }, [roles])

  const renderUserTable = (emptyMessage: string, tableTitle: string) => (
    <ServerPaginatedTable<RbacUserRow>
      title={tableTitle}
      description="Application accounts, roles, and activation status"
      columns={[
        { key: 'name', label: 'User' },
        { key: 'category', label: 'Category' },
        { key: 'roles', label: 'Roles' },
        { key: 'scope', label: 'Data scope' },
        { key: 'status', label: 'Status' },
        { key: 'last_login', label: 'Last login' },
        { key: 'actions', label: '', align: 'right' },
      ]}
      rows={users}
      pagination={userPagination}
      onPageChange={setUserPage}
      rowKey={(row) => row.id}
      emptyMessage={emptyMessage}
      renderRow={(row) => (
        <>
          <td className="px-4 py-3">
            <div className="font-medium text-ui-text">{row.name}</div>
            <div className="text-xs text-gray-500">{row.email}</div>
          </td>
          <td className="px-4 py-3">
            <CategoryBadge category={row.account_category} />
          </td>
          <td className="px-4 py-3">
            <div className="flex flex-wrap gap-1">
              {row.roles.map((code) => (
                <span
                  key={code}
                  className="rounded-sm bg-moh-background px-1.5 py-0.5 text-[10px] font-medium text-moh-green"
                >
                  {rolesByCode.get(code)?.name ?? code}
                </span>
              ))}
            </div>
          </td>
          <td className="px-4 py-3 text-xs text-gray-600">{formatScopeLabel(row)}</td>
          <td className="px-4 py-3">
            <Switch
              {...mt}
              checked={row.is_active}
              disabled={row.is_super_admin || toggleActiveMutation.isPending}
              onChange={() =>
                toggleActiveMutation.mutate({ id: row.id, is_active: !row.is_active })
              }
              label={
                <span className="text-xs">{row.is_active ? 'Active' : 'Inactive'}</span>
              }
            />
          </td>
          <td className="px-4 py-3 text-xs text-gray-500">{formatDate(row.last_login_at)}</td>
          <td className="px-4 py-3 text-right">
            <Button
              {...mt}
              size="sm"
              variant="outlined"
              className="rounded-sm border-moh-green/30 normal-case text-moh-green hover:bg-moh-green/5"
              onClick={() => {
                setManageUser(row)
                setManageScope(scopeFormFromUser(row))
              }}
            >
              Manage
            </Button>
          </td>
        </>
      )}
    />
  )

  const renderAuditRow = (row: AuditLogRow) => (
    <>
      <td className="px-4 py-3 text-xs text-gray-600">{formatDate(row.created_at)}</td>
      <td className="px-4 py-3">
        <div className="text-sm font-medium">{row.actor_name || 'System'}</div>
        <div className="text-xs text-gray-500">{row.actor_email}</div>
      </td>
      <td className="px-4 py-3">
        <span className="rounded-sm bg-gray-100 px-1.5 py-0.5 font-mono text-[10px]">
          {row.action}
        </span>
      </td>
      <td className="px-4 py-3 text-sm">{row.summary}</td>
      <td className="px-4 py-3">
        {row.is_dangerous ? (
          <Chip
            {...mt}
            value="Dangerous"
            size="sm"
            className="rounded-sm bg-red-50 text-red-800"
            icon={<AlertTriangle className="h-3 w-3" />}
          />
        ) : (
          <span className="text-xs text-gray-400">Standard</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {row.is_recoverable && !row.is_recovered ? (
          <Button
            {...mt}
            size="sm"
            color="amber"
            className="inline-flex items-center gap-1 rounded-sm normal-case"
            disabled={recoverMutation.isPending}
            onClick={() => recoverMutation.mutate(row.id)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Recover
          </Button>
        ) : row.is_recovered ? (
          <span className="text-xs font-medium text-green-700">Recovered</span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
    </>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access Control & User Management"
        subtitle="ISO-aligned identity governance — roles, executive accounts, and auditable security actions"
      />

      <SegmentedTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'users', label: 'User Management', icon: <Users className="h-4 w-4" />, count: userPagination.total },
          { value: 'executive', label: 'Executive Accounts', icon: <Crown className="h-4 w-4" /> },
          { value: 'roles', label: 'Roles & Permissions', icon: <Shield className="h-4 w-4" /> },
          { value: 'audit', label: 'Audit Log', icon: <History className="h-4 w-4" />, count: auditPagination.total },
        ]}
      />

      {(tab === 'users' || tab === 'executive') && (
        <QueryState
          isLoading={usersQuery.isLoading}
          isError={usersQuery.isError}
          error={usersQuery.error}
          label="users"
          variant="table"
          onRetry={() => usersQuery.refetch()}
        >
          {tab === 'executive' && (
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {executiveRoles.map((role) => (
                <Card
                  key={role.id}
                  {...mt}
                  className="rounded-sm border border-amber-200/60 bg-amber-50/40 p-4"
                >
                  <Typography {...mt} className="text-xs font-bold uppercase text-amber-900">
                    {role.name}
                  </Typography>
                  <Typography {...mt} className="mt-1 text-[11px] text-amber-800/80">
                    {role.code.replace(/_/g, ' ')} · Level {role.hierarchy_level}
                  </Typography>
                  <p className="mt-2 text-xs text-gray-600">
                    PS, Directors, and Heads of Department — organization-wide decision authority.
                  </p>
                </Card>
              ))}
            </div>
          )}

          <Card {...mt} className="space-y-4 rounded-sm border border-moh-green/15 p-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-4">
                <Input
                  {...mt}
                  label="Search users"
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value)
                    setUserPage(1)
                  }}
                  crossOrigin=""
                />
              </div>
              <div className="min-w-0 lg:col-span-2">
                <Select
                  {...mt}
                  label="Role"
                  value={userRoleFilter}
                  containerProps={{ className: 'min-w-0' }}
                  onChange={(v) => {
                    setUserRoleFilter((v as string) ?? '')
                    setUserPage(1)
                  }}
                >
                  <Option value="">All roles</Option>
                  {roles.map((r) => (
                    <Option key={r.id} value={r.code}>
                      {r.name}
                    </Option>
                  ))}
                </Select>
              </div>
              <div className="min-w-0 lg:col-span-2">
                <Select
                  {...mt}
                  label="District scope"
                  value={userScopeFilter}
                  containerProps={{ className: 'min-w-0' }}
                  onChange={(v) => {
                    setUserScopeFilter((v as string) ?? '')
                    setUserPage(1)
                  }}
                >
                  <Option value="">All districts</Option>
                  {(scopeOptions?.districts ?? []).map((d) => (
                    <Option key={d.id} value={d.id}>
                      {d.name}
                    </Option>
                  ))}
                </Select>
              </div>
              <div className="min-w-0 lg:col-span-2">
                <Select
                  {...mt}
                  label="Status"
                  value={userActiveFilter}
                  containerProps={{ className: 'min-w-0' }}
                  onChange={(v) => {
                    setUserActiveFilter((v as string) ?? '')
                    setUserPage(1)
                  }}
                >
                  <Option value="">All</Option>
                  <Option value="true">Active</Option>
                  <Option value="false">Inactive</Option>
                </Select>
              </div>
              {tab === 'users' ? (
                <div className="flex lg:col-span-2 lg:justify-end">
                  <Button
                    {...mt}
                    className="w-full rounded-sm bg-moh-green normal-case lg:w-auto"
                    onClick={() => setCreateOpen(true)}
                  >
                    <UserCog className="mr-2 h-4 w-4" />
                    Create user
                  </Button>
                </div>
              ) : (
                <div className="hidden lg:col-span-2 lg:block" />
              )}
            </div>

            {renderUserTable(
              tab === 'executive'
                ? 'No executive decision-maker accounts found.'
                : 'No application users match your filters.',
              tab === 'executive' ? 'Executive accounts' : 'Application users',
            )}
          </Card>
        </QueryState>
      )}

      {tab === 'roles' && (
        <QueryState
          isLoading={rolesQuery.isLoading || permsQuery.isLoading}
          isError={rolesQuery.isError || permsQuery.isError}
          error={rolesQuery.error ?? permsQuery.error}
          label="RBAC configuration"
          variant="form"
          onRetry={() => {
            rolesQuery.refetch()
            permsQuery.refetch()
          }}
        >
          <RolePermissionsPanel
            roles={roles}
            permissions={permissions}
            selectedRoleCode={selectedRoleCode}
            onSelectRole={setSelectedRoleCode}
          />
        </QueryState>
      )}

      {tab === 'audit' && (
        <QueryState
          isLoading={auditQuery.isLoading}
          isError={auditQuery.isError}
          error={auditQuery.error}
          label="audit log"
          variant="table"
          onRetry={() => auditQuery.refetch()}
        >
          <Card {...mt} className="space-y-4 rounded-sm border border-moh-green/15 p-4">
            <div className="rounded-sm border border-amber-200 bg-amber-50/50 p-3 text-sm text-amber-950">
              <strong>ISO 27001 control:</strong> All dangerous RBAC changes are logged with actor,
              timestamp, and IP. Recoverable actions (role revoke, deactivation, permission grants)
              can be rolled back from this log.
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
              <div className="sm:col-span-2 lg:col-span-5">
                <Input
                  {...mt}
                  label="Search audit log"
                  value={auditSearch}
                  onChange={(e) => {
                    setAuditSearch(e.target.value)
                    setAuditPage(1)
                  }}
                  crossOrigin=""
                />
              </div>
              <div className="min-w-0 lg:col-span-3">
                <Select
                  {...mt}
                  label="Severity"
                  value={auditDangerous}
                  containerProps={{ className: 'min-w-0' }}
                  onChange={(v) => {
                    setAuditDangerous((v as string) ?? '')
                    setAuditPage(1)
                  }}
                >
                  <Option value="">All events</Option>
                  <Option value="true">Dangerous only</Option>
                </Select>
              </div>
              <div className="min-w-0 lg:col-span-4">
                <Select
                  {...mt}
                  label="Recovery"
                  value={auditRecovered}
                  containerProps={{ className: 'min-w-0' }}
                  onChange={(v) => {
                    setAuditRecovered((v as string) ?? '')
                    setAuditPage(1)
                  }}
                >
                  <Option value="">All</Option>
                  <Option value="false">Pending recovery</Option>
                  <Option value="true">Recovered</Option>
                </Select>
              </div>
            </div>

            <ServerPaginatedTable<AuditLogRow>
              title="Security audit log"
              description="Dangerous RBAC actions with recovery support"
              columns={[
                { key: 'time', label: 'When' },
                { key: 'actor', label: 'Actor' },
                { key: 'action', label: 'Action' },
                { key: 'summary', label: 'Summary' },
                { key: 'severity', label: 'Severity' },
                { key: 'recover', label: '', align: 'right' },
              ]}
              rows={auditRows}
              pagination={auditPagination}
              onPageChange={setAuditPage}
              rowKey={(row) => row.id}
              emptyMessage="No audit events recorded yet."
              renderRow={renderAuditRow}
            />
          </Card>
        </QueryState>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card {...mt} className="max-h-[90vh] w-full max-w-xl overflow-y-auto space-y-4 rounded-sm p-6">
            <Typography {...mt} className="text-lg font-bold text-moh-green">
              Create application user
            </Typography>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                {...mt}
                label="Full name"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                crossOrigin=""
              />
              <Input
                {...mt}
                label="Email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                crossOrigin=""
              />
              <Input
                {...mt}
                label="Password (min 10 chars)"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                crossOrigin=""
                containerProps={{ className: 'sm:col-span-2' }}
              />
              <Select
                {...mt}
                label="Primary role"
                value={createForm.role_codes}
                onChange={(v) => setCreateForm((f) => ({ ...f, role_codes: (v as string) ?? 'staff' }))}
                containerProps={{ className: 'sm:col-span-2' }}
              >
                {roles.map((r) => (
                  <Option key={r.id} value={r.code}>
                    {r.name}
                  </Option>
                ))}
              </Select>
            </div>
            <ScopeFieldsForm
              value={createForm}
              options={scopeOptions}
              onChange={(patch) => setCreateForm((f) => ({ ...f, ...patch }))}
            />
            <div className="flex justify-end gap-2">
              <Button {...mt} variant="text" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                {...mt}
                className="bg-moh-green"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                Create
              </Button>
            </div>
          </Card>
        </div>
      )}

      {manageUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card {...mt} className="max-h-[90vh] w-full max-w-xl overflow-y-auto space-y-4 rounded-sm p-6">
            <Typography {...mt} className="text-lg font-bold text-moh-green">
              Manage {manageUser.name}
            </Typography>
            <p className="text-sm text-gray-600">{manageUser.email}</p>
            <CategoryBadge category={manageUser.account_category} />

            <ScopeFieldsForm
              value={manageScope}
              options={scopeOptions}
              onChange={(patch) => setManageScope((s) => ({ ...s, ...patch }))}
            />
            <Button
              {...mt}
              size="sm"
              className="rounded-sm bg-moh-green normal-case"
              disabled={updateScopeMutation.isPending}
              onClick={() => updateScopeMutation.mutate()}
            >
              Save data scope
            </Button>

            <div>
              <Typography {...mt} className="mb-2 text-xs font-bold uppercase text-gray-500">
                Assigned roles
              </Typography>
              <div className="flex flex-wrap gap-2">
                {manageUser.roles.map((code) => (
                  <Button
                    key={code}
                    {...mt}
                    size="sm"
                    variant="outlined"
                    color="red"
                    className="rounded-sm normal-case"
                    disabled={code === 'super_admin' || revokeMutation.isPending}
                    onClick={() => revokeMutation.mutate(code)}
                  >
                    Remove {rolesByCode.get(code)?.name ?? code}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Select
                {...mt}
                label="Add role"
                value={assignRoleCode}
                onChange={(v) => setAssignRoleCode((v as string) ?? '')}
              >
                {roles
                  .filter((r) => r.code !== 'super_admin' && !manageUser.roles.includes(r.code))
                  .map((r) => (
                    <Option key={r.id} value={r.code}>
                      {r.name}
                    </Option>
                  ))}
              </Select>
              <Button
                {...mt}
                className="mt-6 shrink-0 bg-moh-green"
                disabled={!assignRoleCode || assignMutation.isPending}
                onClick={() => assignMutation.mutate()}
              >
                Assign
              </Button>
            </div>

            {permissions.length > 0 ? (
              <UserPermissionsPanel
                userId={manageUser.id}
                permissions={permissions}
                rolePermissionCodes={manageRolePermsQuery.data ?? []}
              />
            ) : null}

            <div className="flex justify-end">
              <Button {...mt} variant="text" onClick={() => setManageUser(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function ScopeFieldsForm({
  value,
  options,
  onChange,
}: {
  value: ScopeFormState
  options?: ScopeOptions
  onChange: (patch: Partial<ScopeFormState>) => void
}) {
  const selectedRegionSet = useMemo(() => new Set(value.region_ids), [value.region_ids])
  const selectedDistrictSet = useMemo(() => new Set(value.district_ref_ids), [value.district_ref_ids])

  const visibleDistricts = useMemo(() => {
    const districts = options?.districts ?? []
    if (selectedRegionSet.size === 0) return districts
    return districts.filter((d) => d.region_id && selectedRegionSet.has(d.region_id))
  }, [options?.districts, selectedRegionSet])

  const visibleFacilities = useMemo(() => {
    const facilities = options?.facilities ?? []
    if (selectedDistrictSet.size > 0) {
      return facilities.filter((f) => f.district_ref_id && selectedDistrictSet.has(f.district_ref_id))
    }
    if (selectedRegionSet.size > 0) {
      return facilities.filter((f) => f.region_id && selectedRegionSet.has(f.region_id))
    }
    return facilities
  }, [options?.facilities, selectedDistrictSet, selectedRegionSet])

  const toggleId = (ids: number[], id: number) =>
    ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]

  return (
    <div className="space-y-3 rounded-sm border border-gray-100 bg-gray-50/80 p-3">
      <Typography {...mt} className="text-xs font-bold uppercase text-gray-500">
        Data access scope
      </Typography>
      <p className="text-xs text-gray-500">
        Geography flows Region → District → Facility. Assign one or more areas; national scope
        overrides geographic limits.
      </p>
      <Select
        {...mt}
        label="Scope level"
        value={value.scope_level}
        onChange={(v) => onChange({ scope_level: (v as string) ?? 'staff' })}
      >
        {(options?.levels ?? []).map((level) => (
          <Option key={level.value} value={level.value}>
            {level.label}
          </Option>
        ))}
      </Select>

      {value.scope_level !== 'national' && (
        <div className="grid gap-4 md:grid-cols-2">
          <ScopeMultiPicker
            title="Regions"
            items={(options?.regions ?? []).map((r) => ({
              id: r.id,
              label: r.name,
              hint: r.code,
            }))}
            selected={value.region_ids}
            onToggle={(id) => onChange({ region_ids: toggleId(value.region_ids, id) })}
          />
          <ScopeMultiPicker
            title="Districts"
            items={visibleDistricts.map((d) => ({
              id: d.ref_id,
              label: d.name,
              hint: d.code,
            }))}
            selected={value.district_ref_ids}
            onToggle={(id) => onChange({ district_ref_ids: toggleId(value.district_ref_ids, id) })}
          />
          <div className="md:col-span-2">
            <ScopeMultiPicker
              title="Facilities"
              items={visibleFacilities.map((f) => ({
                id: f.id,
                label: f.name,
                hint: f.district_name ? `${f.district_name}${f.district_id ? ` · ${f.district_id}` : ''}` : f.district_id,
              }))}
              selected={value.facility_ids}
              onToggle={(id) => onChange({ facility_ids: toggleId(value.facility_ids, id) })}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ScopeMultiPicker({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string
  items: Array<{ id: number; label: string; hint?: string }>
  selected: number[]
  onToggle: (id: number) => void
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return items
    return items.filter((item) => `${item.label} ${item.hint ?? ''}`.toLowerCase().includes(needle))
  }, [items, query])

  return (
    <div>
      <Typography {...mt} className="mb-1 text-xs font-semibold text-gray-700">
        {title}
        {selected.length > 0 ? ` (${selected.length} selected)` : ''}
      </Typography>
      <Input
        {...mt}
        crossOrigin=""
        placeholder={`Search ${title.toLowerCase()}…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="!min-h-9"
      />
      <div className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-sm border border-gray-200 bg-white p-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400">No matches</p>
        ) : (
          filtered.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-start gap-2 rounded-sm px-1 py-0.5 text-sm hover:bg-gray-50"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={selected.includes(item.id)}
                onChange={() => onToggle(item.id)}
              />
              <span>
                {item.label}
                {item.hint ? (
                  <span className="ml-1 text-xs text-gray-400">({item.hint})</span>
                ) : null}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}

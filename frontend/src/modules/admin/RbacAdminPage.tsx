import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Chip,
  Input,
  Option,
  Select,
  Switch,
  Typography,
} from '@material-tailwind/react'
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
} from '@/api/services/rbacAdmin'
import { PageHeader } from '@/components/organisms/PageHeader'
import { QueryState } from '@/components/organisms/QueryState'
import { ServerPaginatedTable } from '@/components/organisms/ServerPaginatedTable'
import { SegmentedTabs } from '@/components/molecules/SegmentedTabs'
import { useAdminPageSize } from '@/hooks/useAdminPageSize'
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
  const [userRoleFilter, setUserRoleFilter] = useState('')
  const [userScopeFilter, setUserScopeFilter] = useState('')
  const [userActiveFilter, setUserActiveFilter] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [auditSearch, setAuditSearch] = useState('')
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
    scope_level: 'staff',
    scope_district_id: '',
    scope_facility_id: '',
  })
  const [manageScope, setManageScope] = useState({
    scope_level: 'staff',
    scope_district_id: '',
    scope_facility_id: '',
  })

  const rolesQuery = useQuery({
    queryKey: ['admin', 'rbac', 'roles'],
    queryFn: () => rbacAdminService.listRoles(),
  })

  const executiveRolesQuery = useQuery({
    queryKey: ['admin', 'rbac', 'roles', 'executive'],
    queryFn: () => rbacAdminService.listRoles('executive'),
  })

  const permsQuery = useQuery({
    queryKey: ['admin', 'rbac', 'permissions'],
    queryFn: () => rbacAdminService.listPermissions(),
  })

  const scopeOptionsQuery = useQuery({
    queryKey: ['admin', 'rbac', 'scope-options'],
    queryFn: () => rbacAdminService.listScopeOptions(),
  })

  const usersQuery = useQuery({
    queryKey: [
      'admin',
      'rbac',
      'users',
      tab,
      userSearch,
      userRoleFilter,
      userActiveFilter,
      userScopeFilter,
      userPage,
      pageSize,
    ],
    queryFn: () =>
      rbacAdminService.listUsers({
        search: userSearch || undefined,
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
    queryKey: ['admin', 'rbac', 'audit', auditSearch, auditDangerous, auditRecovered, auditPage, pageSize],
    queryFn: () =>
      rbacAdminService.listAuditLogs({
        search: auditSearch || undefined,
        module: 'rbac',
        dangerous: auditDangerous || undefined,
        recovered: auditRecovered || undefined,
        page: auditPage,
        per_page: pageSize,
      }),
    enabled: tab === 'audit',
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
        scope_district_id: createForm.scope_district_id || undefined,
        scope_facility_id: createForm.scope_facility_id
          ? Number(createForm.scope_facility_id)
          : undefined,
      }),
    onSuccess: () => {
      invalidateUsers()
      setCreateOpen(false)
      setCreateForm({
        name: '',
        email: '',
        password: '',
        role_codes: 'staff',
        scope_level: 'staff',
        scope_district_id: '',
        scope_facility_id: '',
      })
    },
  })

  const updateScopeMutation = useMutation({
    mutationFn: () =>
      rbacAdminService.updateUser(manageUser!.id, {
        scope_level: manageScope.scope_level,
        scope_district_id: manageScope.scope_district_id || '',
        scope_facility_id: manageScope.scope_facility_id
          ? Number(manageScope.scope_facility_id)
          : 0,
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

  const scopeOptions = scopeOptionsQuery.data
  const roles = rolesQuery.data ?? []
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
                setManageScope({
                  scope_level: row.scope_level || 'staff',
                  scope_district_id: row.scope_district_id || '',
                  scope_facility_id: row.scope_facility_id ? String(row.scope_facility_id) : '',
                })
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
          onRetry={() => {
            rolesQuery.refetch()
            permsQuery.refetch()
          }}
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <Card {...mt} className="rounded-sm border border-moh-green/15 p-4">
              <Typography {...mt} className="mb-3 text-sm font-bold uppercase text-moh-green">
                Roles by category
              </Typography>
              <ul className="space-y-2 text-sm">
                {roles.map((r) => (
                  <li key={r.id} className="flex items-center justify-between border-b border-gray-100 py-2">
                    <div>
                      <span className="font-medium">{r.name}</span>
                      <span className="ml-2 text-xs text-gray-500">{r.code}</span>
                    </div>
                    <CategoryBadge category={(r.category as RoleCategory) || 'operational'} />
                  </li>
                ))}
              </ul>
            </Card>
            <Card {...mt} className="rounded-sm border border-moh-green/15 p-4">
              <Typography {...mt} className="mb-3 text-sm font-bold uppercase text-moh-green">
                Permissions
              </Typography>
              <div className="max-h-96 overflow-y-auto text-xs">
                {(permsQuery.data ?? []).map((p) => (
                  <div key={p.id} className="border-b border-gray-50 py-1.5">
                    <span className="font-medium">{p.code}</span>
                    <span className="ml-2 text-gray-500">{p.name}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </QueryState>
      )}

      {tab === 'audit' && (
        <QueryState
          isLoading={auditQuery.isLoading}
          isError={auditQuery.isError}
          error={auditQuery.error}
          label="audit log"
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
          <Card {...mt} className="w-full max-w-md space-y-4 rounded-sm p-6">
            <Typography {...mt} className="text-lg font-bold text-moh-green">
              Create application user
            </Typography>
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
            />
            <Select
              {...mt}
              label="Primary role"
              value={createForm.role_codes}
              onChange={(v) => setCreateForm((f) => ({ ...f, role_codes: (v as string) ?? 'staff' }))}
            >
              {roles.map((r) => (
                <Option key={r.id} value={r.code}>
                  {r.name}
                </Option>
              ))}
            </Select>
            <ScopeFieldsForm
              scopeLevel={createForm.scope_level}
              scopeDistrictId={createForm.scope_district_id}
              scopeFacilityId={createForm.scope_facility_id}
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
          <Card {...mt} className="w-full max-w-lg space-y-4 rounded-sm p-6">
            <Typography {...mt} className="text-lg font-bold text-moh-green">
              Manage {manageUser.name}
            </Typography>
            <p className="text-sm text-gray-600">{manageUser.email}</p>
            <CategoryBadge category={manageUser.account_category} />

            <ScopeFieldsForm
              scopeLevel={manageScope.scope_level}
              scopeDistrictId={manageScope.scope_district_id}
              scopeFacilityId={manageScope.scope_facility_id}
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
  scopeLevel,
  scopeDistrictId,
  scopeFacilityId,
  options,
  onChange,
}: {
  scopeLevel: string
  scopeDistrictId: string
  scopeFacilityId: string
  options?: import('@/api/services/rbacAdmin').ScopeOptions
  onChange: (patch: {
    scope_level?: string
    scope_district_id?: string
    scope_facility_id?: string
  }) => void
}) {
  return (
    <div className="space-y-3 rounded-sm border border-gray-100 bg-gray-50/80 p-3">
      <Typography {...mt} className="text-xs font-bold uppercase text-gray-500">
        Data access scope
      </Typography>
      <p className="text-xs text-gray-500">
        MoH oversees nationally; HR Officers and Directors are typically scoped to a district.
        Facility accounts are limited to one site. National scope is for MoH HQ overseers only.
      </p>
      <Select
        {...mt}
        label="Scope level"
        value={scopeLevel}
        onChange={(v) => onChange({ scope_level: (v as string) ?? 'staff' })}
      >
        {(options?.levels ?? []).map((level) => (
          <Option key={level.value} value={level.value}>
            {level.label}
          </Option>
        ))}
      </Select>
      {(scopeLevel === 'district' || scopeLevel === 'facility') && (
        <Select
          {...mt}
          label="District"
          value={scopeDistrictId}
          onChange={(v) => onChange({ scope_district_id: (v as string) ?? '' })}
        >
          <Option value="">Select district</Option>
          {(options?.districts ?? []).map((d) => (
            <Option key={d.id} value={d.id}>
              {d.name}
            </Option>
          ))}
        </Select>
      )}
      {scopeLevel === 'facility' && (
        <Select
          {...mt}
          label="Facility"
          value={scopeFacilityId}
          onChange={(v) => onChange({ scope_facility_id: (v as string) ?? '' })}
        >
          <Option value="">Select facility</Option>
          {(options?.facilities ?? []).map((f) => (
            <Option key={f.id} value={String(f.id)}>
              {f.name}
            </Option>
          ))}
        </Select>
      )}
    </div>
  )
}

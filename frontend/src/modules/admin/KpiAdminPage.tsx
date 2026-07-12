import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  CheckCircle2,
  Filter,
  Hash,
  Layers,
  Link2,
  Pencil,
  Plus,
  Shield,
  Target,
  Trash2,
  User,
  X,
  XCircle,
} from 'lucide-react'
import {
  Button,
  Card,
  Chip,
  Input,
  Switch,
  Tab,
  Tabs,
  TabsHeader,
  Typography,
} from '@material-tailwind/react'
import { Select, Option } from '@/components/molecules/MtSelect'
import { SearchableSelect } from '@/components/molecules/SearchableSelect'
import {
  kpiAdminService,
  type KpiAssignmentRow,
  type KpiAssignmentTargetOption,
  type KpiRow,
} from '@/api/services/kpiAdmin'
import { kpiCategoryLabel } from '@/utils/normalizeApi'
import { PageHeader } from '@/components/organisms/PageHeader'
import { ProcessGuide } from '@/components/organisms/ProcessGuide'
import { QueryState } from '@/components/organisms/QueryState'
import { useAuthStore } from '@/stores/appStore'
import { useAdminPageSize } from '@/hooks/useAdminPageSize'
import { ServerPaginatedTable } from '@/components/organisms/ServerPaginatedTable'
import { mt } from '@/utils/mt'
import { notifyApiError, toast } from '@/features/toast'

const KPI_STEPS = [
  {
    title: 'Maintain the KPI catalog',
    description:
      'Ordinary KPIs come from the legacy national indicator set. Score card KPIs cover MoH strategic targets.',
    actor: 'HR / Admin',
  },
  {
    title: 'Assign KPIs to roles',
    description:
      'Map KPIs by facility type, facility, department, job title, or individual staff — each level is independent.',
    actor: 'HR Officer',
  },
  {
    title: 'Staff build their PPA',
    description: 'Assigned KPIs appear grouped by function on the Performance page when employees plan their year.',
    actor: 'Employee',
  },
]

type AssignLevel = 'facility_type' | 'facility' | 'department' | 'job' | 'staff'

const ASSIGN_LEVELS: Array<{
  id: AssignLevel
  label: string
  hint: string
  icon: typeof Layers
}> = [
  {
    id: 'facility_type',
    label: 'Facility type',
    hint: 'Every facility of this type (e.g. HCIII, National Referral)',
    icon: Layers,
  },
  {
    id: 'facility',
    label: 'Facility',
    hint: 'One specific facility',
    icon: Building2,
  },
  {
    id: 'department',
    label: 'Department',
    hint: 'Department pool — facility type shown for context only',
    icon: Building2,
  },
  {
    id: 'job',
    label: 'Job title',
    hint: 'Everyone with this job title',
    icon: Briefcase,
  },
  {
    id: 'staff',
    label: 'Individual',
    hint: 'One staff member',
    icon: User,
  },
]

function assignmentTargetLabel(row: KpiAssignmentRow) {
  if (row.assignable_type === 'facility_type') return row.facility_type_name || '—'
  if (row.assignable_type === 'facility') return row.facility_name || '—'
  if (row.assignable_type === 'department') {
    const name = row.department_name || '—'
    return row.facility_type_name ? `${name} · ${row.facility_type_name}` : name
  }
  if (row.assignable_type === 'job') return row.job_title || '—'
  return row.staff_name || '—'
}

function assignTypeLabel(type: string) {
  const labels: Record<string, string> = {
    facility_type: 'Facility type',
    facility: 'Facility',
    department: 'Department',
    job: 'Job title',
    staff: 'Individual',
  }
  return labels[type] ?? type
}

function targetOptionsToSelect(
  items: KpiAssignmentTargetOption[] | undefined,
): { value: string; label: string; description?: string }[] {
  return (items ?? []).map((item) => ({
    value: String(item.id),
    label: item.name,
    description: item.subtitle,
  }))
}

const emptyKpiForm = {
  kpi_code: '',
  short_name: '',
  indicator_statement: '',
  frequency: 'Quarterly',
  computation_category: 'Ratio',
  subject_area: '',
  category_id: '',
  current_target: '',
  is_cumulative: false,
  status: true,
}

type KpiModalMode = 'create' | 'edit' | null

function apiErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
  ) {
    return (error as { response: { data: { message: string } } }).response.data.message
  }
  return fallback
}

export function KpiAdminPage() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthStore()
  const pageSize = useAdminPageSize()
  const canViewCatalog = hasPermission(['kpi.catalog.view', 'kpi.catalog.manage'])
  const canManageCatalog = hasPermission('kpi.catalog.manage')
  const canViewAssignments = hasPermission(['kpi.assignments.view', 'kpi.assignments.manage'])
  const canManageAssignments = hasPermission('kpi.assignments.manage')

  const [tab, setTab] = useState(canViewCatalog ? 'catalog' : 'assignments')
  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [kpiPage, setKpiPage] = useState(1)
  const [assignmentPage, setAssignmentPage] = useState(1)
  const [assignmentSearch, setAssignmentSearch] = useState('')
  const [assignmentTypeFilter, setAssignmentTypeFilter] = useState('')
  const [kpiModalMode, setKpiModalMode] = useState<KpiModalMode>(null)
  const [editingKpi, setEditingKpi] = useState<KpiRow | null>(null)
  const [kpiFormError, setKpiFormError] = useState('')
  const [kpiForm, setKpiForm] = useState(emptyKpiForm)
  const [assignForm, setAssignForm] = useState({
    kpi_ids: [] as string[],
    assignable_type: 'facility_type' as AssignLevel,
    facility_type_ref_id: '',
    facility_id: '',
    department_id: '',
    job_id: '',
    staff_id: '',
    staff_search: '',
  })
  const [kpiAssignSearch, setKpiAssignSearch] = useState('')

  const permissionsQuery = useQuery({
    queryKey: ['admin', 'kpi', 'permissions'],
    queryFn: () => kpiAdminService.permissions(),
  })

  const subjectAreasQuery = useQuery({
    queryKey: ['admin', 'kpi', 'subject-areas'],
    queryFn: () => kpiAdminService.subjectAreas(),
    enabled: canViewCatalog,
  })

  const categoriesQuery = useQuery({
    queryKey: ['admin', 'kpi', 'categories'],
    queryFn: () => kpiAdminService.categories(),
    enabled: canManageCatalog,
  })

  const nextKpiCodeQuery = useQuery({
    queryKey: ['admin', 'kpi', 'next-code', kpiForm.category_id],
    queryFn: () => kpiAdminService.nextKpiCode(Number(kpiForm.category_id)),
    enabled: kpiModalMode === 'create' && Boolean(kpiForm.category_id),
  })

  const kpisQuery = useQuery({
    queryKey: ['admin', 'kpi', 'list', search, subjectFilter, categoryFilter, kpiPage, pageSize],
    queryFn: () => {
      const category = categoriesQuery.data?.find(
        (c) =>
          c.category_name === categoryFilter ||
          kpiCategoryLabel(c.category_name) === categoryFilter,
      )
      return kpiAdminService.listKpis({
        search: search || undefined,
        subject_area: subjectFilter ? Number(subjectFilter) : undefined,
        category_id: category?.id,
        page: kpiPage,
        per_page: pageSize,
      })
    },
    enabled: canViewCatalog || canManageAssignments,
  })

  const assignmentKpisQuery = useQuery({
    queryKey: ['admin', 'kpi', 'assignment-options'],
    queryFn: () =>
      kpiAdminService.listKpis({
        active_only: true,
        page: 1,
        per_page: 1000,
      }),
    enabled: canManageAssignments,
  })

  const assignmentTargetsQuery = useQuery({
    queryKey: ['admin', 'kpi', 'assignment-targets'],
    queryFn: () => kpiAdminService.assignmentTargets(),
    enabled: canManageAssignments,
  })

  const assignmentsQuery = useQuery({
    queryKey: ['admin', 'kpi', 'assignments', assignmentTypeFilter, assignmentSearch, assignmentPage, pageSize],
    queryFn: () =>
      kpiAdminService.listAssignments({
        assignable_type: assignmentTypeFilter || undefined,
        search: assignmentSearch || undefined,
        page: assignmentPage,
        per_page: pageSize,
      }),
    enabled: canViewAssignments,
  })

  const staffQuery = useQuery({
    queryKey: ['admin', 'kpi', 'staff', assignForm.staff_search],
    queryFn: () => kpiAdminService.searchStaff(assignForm.staff_search || undefined),
    enabled: canManageAssignments && assignForm.assignable_type === 'staff',
  })

  const saveKpiMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        short_name: kpiForm.short_name,
        indicator_statement: kpiForm.indicator_statement,
        frequency: kpiForm.frequency,
        computation_category: kpiForm.computation_category,
        subject_area: kpiForm.subject_area ? Number(kpiForm.subject_area) : undefined,
        category_id: kpiForm.category_id ? Number(kpiForm.category_id) : undefined,
        current_target: kpiForm.current_target ? Number(kpiForm.current_target) : undefined,
        is_cumulative: kpiForm.is_cumulative,
        status: kpiForm.status,
      }
      if (kpiModalMode === 'edit' && editingKpi) {
        payload.kpi_code = kpiForm.kpi_code
      }
      return kpiModalMode === 'edit' && editingKpi
        ? kpiAdminService.updateKpi(editingKpi.id, payload)
        : kpiAdminService.createKpi(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'kpi'] })
      toast.success('KPI saved successfully.')
      closeKpiModal()
    },
    onError: (error: unknown) => {
      setKpiFormError(apiErrorMessage(error, 'Could not save KPI'))
      notifyApiError(error, 'Could not save KPI')
    },
  })

  const deactivateKpiMutation = useMutation({
    mutationFn: (id: number) => kpiAdminService.deactivateKpi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'kpi'] })
      toast.success('KPI deactivated.')
      closeKpiModal()
    },
    onError: (error: unknown) => {
      setKpiFormError(apiErrorMessage(error, 'Could not deactivate KPI'))
      notifyApiError(error, 'Could not deactivate KPI')
    },
  })

  const assignMutation = useMutation({
    mutationFn: () =>
      kpiAdminService.createAssignment({
        kpi_ids: assignForm.kpi_ids.map(Number),
        assignable_type: assignForm.assignable_type,
        facility_type_ref_id: assignForm.facility_type_ref_id
          ? Number(assignForm.facility_type_ref_id)
          : undefined,
        facility_id: assignForm.facility_id ? Number(assignForm.facility_id) : undefined,
        job_id: assignForm.job_id ? Number(assignForm.job_id) : undefined,
        department_id: assignForm.department_id ? Number(assignForm.department_id) : undefined,
        staff_id: assignForm.staff_id ? Number(assignForm.staff_id) : undefined,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'kpi', 'assignments'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'kpi', 'list'] })
      setAssignForm((f) => ({ ...f, kpi_ids: [] }))
      const bulk = result as { created?: number; reactivated?: number; failed?: number }
      const total = (bulk.created ?? 0) + (bulk.reactivated ?? 0)
      if (total > 0) {
        toast.success(
          bulk.failed
            ? `Assigned ${total} KPI${total === 1 ? '' : 's'} (${bulk.failed} failed).`
            : `Assigned ${total} KPI${total === 1 ? '' : 's'}.`,
        )
      } else {
        toast.success('KPI assignment saved.')
      }
    },
    onError: (error: unknown) => notifyApiError(error, 'Could not assign KPIs'),
  })

  const removeAssignmentMutation = useMutation({
    mutationFn: (id: number) => kpiAdminService.removeAssignment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'kpi', 'assignments'] }),
  })

  const closeKpiModal = () => {
    setKpiModalMode(null)
    setEditingKpi(null)
    setKpiForm(emptyKpiForm)
    setKpiFormError('')
  }

  const openCreateKpi = () => {
    const defaultCategory = categories[0]
    setKpiModalMode('create')
    setEditingKpi(null)
    setKpiFormError('')
    setKpiForm({
      ...emptyKpiForm,
      category_id: defaultCategory ? String(defaultCategory.id) : '',
    })
  }

  const openEditKpi = (row: KpiRow) => {
    setKpiModalMode('edit')
    setEditingKpi(row)
    setKpiFormError('')
    setKpiForm({
      kpi_code: row.kpi_code,
      short_name: row.short_name,
      indicator_statement: row.indicator_statement,
      frequency: row.frequency,
      computation_category: row.computation_category,
      subject_area: row.subject_area_id ? String(row.subject_area_id) : '',
      category_id: row.category_id ? String(row.category_id) : '',
      current_target: row.current_target != null ? String(row.current_target) : '',
      is_cumulative: row.is_cumulative ?? false,
      status: row.status,
    })
  }

  const saveKpi = () => {
    if (!kpiForm.indicator_statement.trim()) {
      setKpiFormError('Indicator statement is required.')
      return
    }
    if (!kpiForm.category_id) {
      setKpiFormError('Category is required.')
      return
    }
    setKpiFormError('')
    saveKpiMutation.mutate()
  }

  const kpis = kpisQuery.data?.data ?? []
  const kpiPagination = kpisQuery.data ?? { total: 0, page: 1, per_page: pageSize, total_pages: 1 }
  const assignments = assignmentsQuery.data?.data ?? []
  const assignmentPagination = assignmentsQuery.data ?? {
    total: 0,
    page: 1,
    per_page: pageSize,
    total_pages: 1,
  }
  const subjectAreas = subjectAreasQuery.data ?? []
  const categories = categoriesQuery.data ?? []
  const assignmentTargets = assignmentTargetsQuery.data
  const staffOptions = staffQuery.data ?? []
  const assignmentKpis = assignmentKpisQuery.data?.data ?? []
  const filteredAssignmentKpis = useMemo(() => {
    const needle = kpiAssignSearch.trim().toLowerCase()
    if (!needle) return assignmentKpis
    return assignmentKpis.filter((kpi) => {
      const haystack = `${kpi.kpi_code} ${kpi.short_name} ${kpi.indicator_statement} ${kpi.subject_area_name ?? ''}`.toLowerCase()
      return haystack.includes(needle)
    })
  }, [assignmentKpis, kpiAssignSearch])

  const toggleAssignKpi = (kpiId: string) => {
    setAssignForm((f) => ({
      ...f,
      kpi_ids: f.kpi_ids.includes(kpiId)
        ? f.kpi_ids.filter((id) => id !== kpiId)
        : [...f.kpi_ids, kpiId],
    }))
  }

  const selectAllKpis = () => {
    setAssignForm((f) => ({
      ...f,
      kpi_ids: assignmentKpis.map((kpi) => String(kpi.id)),
    }))
  }

  const selectFilteredKpis = () => {
    const visibleIds = filteredAssignmentKpis.map((kpi) => String(kpi.id))
    setAssignForm((f) => ({
      ...f,
      kpi_ids: Array.from(new Set([...f.kpi_ids, ...visibleIds])),
    }))
  }

  const clearKpiSelection = () => {
    setAssignForm((f) => ({ ...f, kpi_ids: [] }))
  }
  const assignTargetReady =
    (assignForm.assignable_type === 'facility_type' && Boolean(assignForm.facility_type_ref_id)) ||
    (assignForm.assignable_type === 'facility' && Boolean(assignForm.facility_id)) ||
    (assignForm.assignable_type === 'job' && Boolean(assignForm.job_id)) ||
    (assignForm.assignable_type === 'department' && Boolean(assignForm.department_id)) ||
    (assignForm.assignable_type === 'staff' && Boolean(assignForm.staff_id))
  const activeAssignLevel = ASSIGN_LEVELS.find((level) => level.id === assignForm.assignable_type)
  const staffSelectOptions = staffOptions.map((s) => {
    const parts = [s.job_title, s.department_name, s.facility_name, s.facility_type_name].filter(Boolean)
    return {
      value: String(s.staff_id),
      label: s.name,
      description: parts.length > 0 ? parts.join(' · ') : s.email,
    }
  })
  const canSubmitAssignment = assignForm.kpi_ids.length > 0 && assignTargetReady
  const autoKpiCode =
    kpiModalMode === 'create'
      ? nextKpiCodeQuery.data?.kpi_code || (nextKpiCodeQuery.isLoading ? 'Generating…' : '—')
      : kpiForm.kpi_code

  const myKpiPermissions =
    permissionsQuery.data?.permissions.filter((p) => hasPermission(p.code)) ?? []

  return (
    <div className="pb-8">
      <PageHeader
        title="KPI Management"
        subtitle="Catalog indicators and assign them across facility types, facilities, departments, jobs, and staff"
        actions={
          tab === 'catalog' && canManageCatalog ? (
            <Button
              {...mt}
              size="sm"
              className="flex items-center gap-2 rounded-sm bg-moh-green"
              onClick={openCreateKpi}
            >
              <Plus className="h-4 w-4" />
              New KPI
            </Button>
          ) : null
        }
      />

      <ProcessGuide title="How KPI management works" steps={KPI_STEPS} />

      <Card {...mt} className="mb-6 rounded-sm border border-moh-green/15 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-moh-green" />
          <Typography {...mt} className="text-sm font-bold uppercase text-moh-green">
            Your KPI permissions
          </Typography>
        </div>
        <div className="flex flex-wrap gap-2">
          {myKpiPermissions.length > 0 ? (
            myKpiPermissions.map((p) => (
              <Chip
                key={p.code}
                {...mt}
                value={p.name}
                className="rounded-sm normal-case"
                variant="ghost"
              />
            ))
          ) : (
            <Typography {...mt} className="text-sm text-gray-500">
              No KPI management permissions on your account. Ask an administrator to grant them via Access Control.
            </Typography>
          )}
        </div>
      </Card>

      <Tabs value={tab} className="mb-4">
        <TabsHeader {...mt} className="rounded-sm bg-moh-background">
          {canViewCatalog ? (
            <Tab {...mt} value="catalog" onClick={() => setTab('catalog')}>
              <span className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                KPI Catalog
              </span>
            </Tab>
          ) : null}
          {canViewAssignments ? (
            <Tab {...mt} value="assignments" onClick={() => setTab('assignments')}>
              <span className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Assignments
              </span>
            </Tab>
          ) : null}
          <Tab {...mt} value="permissions" onClick={() => setTab('permissions')}>
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Permissions
            </span>
          </Tab>
        </TabsHeader>
      </Tabs>

      {tab === 'catalog' && canViewCatalog ? (
        <>
          <Card {...mt} className="mb-4 rounded-sm border border-ui-border p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Filter className="h-4 w-4 text-moh-green" />
              Filter catalog
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="relative min-w-[200px] flex-1">
                <Input
                  {...mt}
                  label="Search KPIs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select
                {...mt}
                label="KPI type"
                value={categoryFilter}
                onChange={(v) => {
                  setCategoryFilter(v ?? '')
                  setKpiPage(1)
                }}
                className="min-w-[160px]"
              >
                <Option value="">All types</Option>
                <Option value="Ordinary">Ordinary</Option>
                <Option value="Score card">Score card</Option>
              </Select>
              <Select
                {...mt}
                label="Subject area"
                value={subjectFilter}
                onChange={(v) => setSubjectFilter(v ?? '')}
                className="min-w-[180px]"
              >
                <Option value="">All areas</Option>
                {subjectAreas.map((a) => (
                  <Option key={a.id} value={String(a.id)}>
                    {a.label}
                  </Option>
                ))}
              </Select>
              {canManageCatalog ? (
                <Button
                  {...mt}
                  size="sm"
                  className="flex items-center gap-2 rounded-sm bg-moh-green"
                  onClick={openCreateKpi}
                >
                  <Plus className="h-4 w-4" />
                  New KPI
                </Button>
              ) : null}
            </div>
          </Card>

          <QueryState
            isLoading={kpisQuery.isLoading}
            isError={kpisQuery.isError}
            error={kpisQuery.error}
            label="KPI catalog"
            variant="table"
            onRetry={() => kpisQuery.refetch()}
          >
            <ServerPaginatedTable
              columns={[
                { key: 'code', label: 'Code' },
                { key: 'type', label: 'Type' },
                { key: 'indicator', label: 'Indicator' },
                { key: 'area', label: 'Subject area' },
                { key: 'frequency', label: 'Frequency' },
                { key: 'assignments', label: 'Assignments' },
                { key: 'status', label: 'Status' },
                ...(canManageCatalog ? [{ key: 'actions', label: '' }] : []),
              ]}
              rows={kpis}
              pagination={kpiPagination}
              onPageChange={setKpiPage}
              rowKey={(row) => row.id}
              renderRow={(row) => (
                <>
                  <td className="px-3 py-2 font-mono text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5 text-gray-400" />
                      {row.kpi_code}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Chip
                      {...mt}
                      size="sm"
                      value={kpiCategoryLabel(row.category_name || 'Ordinary')}
                      className="rounded-sm normal-case"
                      color={row.category_name === 'Score card' ? 'amber' : 'gray'}
                      variant="ghost"
                    />
                  </td>
                  <td className="max-w-md px-3 py-2">
                    <div className="font-medium">{row.short_name || row.indicator_statement}</div>
                    {row.short_name ? (
                      <div className="line-clamp-2 text-xs text-gray-500">{row.indicator_statement}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{row.subject_area_name}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1.5">
                      <span>{row.frequency}</span>
                      {row.is_cumulative ? (
                        <Chip
                          {...mt}
                          size="sm"
                          value="Cumulative"
                          className="w-fit rounded-sm normal-case"
                          color="blue"
                          variant="ghost"
                        />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">{row.assignment_count}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      {row.status ? (
                        <CheckCircle2 className="h-4 w-4 text-moh-green" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-400" />
                      )}
                      <Chip
                        {...mt}
                        size="sm"
                        value={row.status ? 'Active' : 'Inactive'}
                        className="rounded-sm"
                        color={row.status ? 'green' : 'gray'}
                      />
                    </span>
                  </td>
                  {canManageCatalog ? (
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm font-medium text-moh-green transition hover:bg-moh-green/10"
                        onClick={() => openEditKpi(row)}
                        aria-label={`Edit ${row.kpi_code}`}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                    </td>
                  ) : null}
                </>
              )}
            />
          </QueryState>
        </>
      ) : null}

      {kpiModalMode ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeKpiModal}
          onKeyDown={(e) => e.key === 'Escape' && closeKpiModal()}
          role="presentation"
        >
          <Card
            {...mt}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-sm border border-moh-green/20 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-moh-green" />
                  <Typography {...mt} className="text-lg font-bold text-moh-green">
                    {kpiModalMode === 'edit' ? `Edit KPI — ${editingKpi?.kpi_code}` : 'Create new KPI'}
                  </Typography>
                </div>
                <Typography {...mt} className="mt-1 text-sm text-gray-600">
                  {kpiModalMode === 'edit'
                    ? 'Update indicator details, targets, and activation status.'
                    : 'Add a new performance indicator to the national catalog.'}
                </Typography>
              </div>
              <button
                type="button"
                className="rounded-sm p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
                onClick={closeKpiModal}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 border-t border-gray-200 pt-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-moh-green">
                <Hash className="h-4 w-4" />
                Identity
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <Input
                    {...mt}
                    label={kpiModalMode === 'create' ? 'KPI code (auto-assigned)' : 'KPI code'}
                    value={autoKpiCode}
                    readOnly
                    disabled
                    className="bg-gray-50"
                  />
                  {kpiModalMode === 'create' ? (
                    <Typography {...mt} variant="small" className="mt-1 text-gray-500">
                      Updates when you change category. Assigned on save.
                    </Typography>
                  ) : null}
                </div>
                <Input
                  {...mt}
                  label="Short name"
                  value={kpiForm.short_name}
                  onChange={(e) => setKpiForm((f) => ({ ...f, short_name: e.target.value }))}
                />
                <Input
                  {...mt}
                  label="Indicator statement"
                  className="md:col-span-2"
                  value={kpiForm.indicator_statement}
                  onChange={(e) => setKpiForm((f) => ({ ...f, indicator_statement: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-8 border-t border-gray-200 pt-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-moh-green">
                <Layers className="h-4 w-4" />
                Classification
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <Select
                  {...mt}
                  label="Subject area"
                  value={kpiForm.subject_area}
                  onChange={(v) => setKpiForm((f) => ({ ...f, subject_area: v ?? '' }))}
                >
                  <Option value="">— Select —</Option>
                  {subjectAreas.map((a) => (
                    <Option key={a.id} value={String(a.id)}>
                      {a.label}
                    </Option>
                  ))}
                </Select>
                <Select
                  {...mt}
                  label="Category"
                  value={kpiForm.category_id}
                  onChange={(v) => setKpiForm((f) => ({ ...f, category_id: v ?? '' }))}
                >
                  {categories.map((c) => (
                    <Option key={c.id} value={String(c.id)}>
                      {kpiCategoryLabel(c.category_name)}
                    </Option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="mt-8 border-t border-gray-200 pt-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-moh-green">
                <BarChart3 className="h-4 w-4" />
                Measurement
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <Select
                  {...mt}
                  label="Frequency"
                  value={kpiForm.frequency}
                  onChange={(v) => setKpiForm((f) => ({ ...f, frequency: v ?? 'Quarterly' }))}
                >
                  <Option value="Quarterly">Quarterly</Option>
                  <Option value="Annual">Annual</Option>
                  <Option value="Monthly">Monthly</Option>
                </Select>
                <Select
                  {...mt}
                  label="Computation"
                  value={kpiForm.computation_category}
                  onChange={(v) => setKpiForm((f) => ({ ...f, computation_category: v ?? 'Ratio' }))}
                >
                  <Option value="Ratio">Ratio</Option>
                  <Option value="Value">Value</Option>
                </Select>
                <Input
                  {...mt}
                  type="number"
                  label="Default target"
                  value={kpiForm.current_target}
                  onChange={(e) => setKpiForm((f) => ({ ...f, current_target: e.target.value }))}
                />
                <div className="flex items-center justify-between rounded-sm border border-gray-100 bg-gray-50/80 px-4 py-3 md:col-span-2">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Cumulative indicator</span>
                    <p className="mt-0.5 text-xs text-gray-500">
                      When enabled, staff report year-to-date totals each period instead of period-only values.
                    </p>
                  </div>
                  <Switch
                    {...mt}
                    checked={kpiForm.is_cumulative}
                    onChange={(e) => setKpiForm((f) => ({ ...f, is_cumulative: e.target.checked }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-sm border border-gray-100 bg-gray-50/80 px-4 py-3">
                  <div className="flex items-center gap-2">
                    {kpiForm.status ? (
                      <CheckCircle2 className="h-4 w-4 text-moh-green" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="text-sm font-medium text-gray-700">Active in catalog</span>
                  </div>
                  <Switch
                    {...mt}
                    checked={kpiForm.status}
                    onChange={(e) => setKpiForm((f) => ({ ...f, status: e.target.checked }))}
                  />
                </div>
              </div>
            </div>

            {kpiFormError ? (
              <Typography {...mt} className="mt-5 text-sm text-red-600">
                {kpiFormError}
              </Typography>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-3 border-t border-gray-200 pt-6">
              <Button
                {...mt}
                size="sm"
                className="flex items-center gap-2 rounded-sm bg-moh-green"
                loading={saveKpiMutation.isPending}
                onClick={saveKpi}
              >
                <CheckCircle2 className="h-4 w-4" />
                {kpiModalMode === 'edit' ? 'Save changes' : 'Create KPI'}
              </Button>
              {kpiModalMode === 'edit' && editingKpi ? (
                <Button
                  {...mt}
                  size="sm"
                  color="red"
                  variant="outlined"
                  className="flex items-center gap-2"
                  loading={deactivateKpiMutation.isPending}
                  onClick={() => deactivateKpiMutation.mutate(editingKpi.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Deactivate
                </Button>
              ) : null}
              <Button {...mt} size="sm" variant="outlined" onClick={closeKpiModal}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'assignments' && canViewAssignments ? (
        <>
          {canManageAssignments ? (
            <Card
              {...mt}
              className="mb-6 overflow-hidden rounded-lg border border-moh-green/20 bg-gradient-to-br from-white via-white to-moh-green/[0.03] p-0 shadow-sm"
            >
              <div className="border-b border-moh-green/10 bg-moh-green/[0.04] px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-moh-green text-white">
                      <Plus className="h-4 w-4" />
                    </span>
                    <div>
                      <Typography {...mt} className="text-sm font-bold uppercase tracking-wide text-ui-text">
                        New assignment
                      </Typography>
                      <Typography {...mt} className="text-xs text-gray-500">
                        Select KPIs, pick a target level, then assign in one step
                      </Typography>
                    </div>
                  </div>
                  <Chip
                    {...mt}
                    value={`${assignForm.kpi_ids.length} selected`}
                    className="rounded-full bg-white normal-case text-moh-green"
                    variant="outlined"
                  />
                </div>
              </div>

              <div className="grid gap-0 lg:grid-cols-2">
                <div className="border-b border-ui-border p-5 lg:border-b-0 lg:border-r">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <Typography {...mt} className="text-sm font-semibold text-ui-text">
                      KPI catalog
                    </Typography>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <button
                        type="button"
                        className="rounded-full border border-moh-green/30 px-2.5 py-1 font-medium text-moh-green transition hover:bg-moh-green/5"
                        onClick={selectAllKpis}
                        disabled={assignmentKpis.length === 0}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-ui-border px-2.5 py-1 font-medium text-gray-600 transition hover:bg-ui-subtle"
                        onClick={selectFilteredKpis}
                        disabled={filteredAssignmentKpis.length === 0}
                      >
                        Select filtered
                      </button>
                      {assignForm.kpi_ids.length > 0 ? (
                        <button
                          type="button"
                          className="rounded-full px-2.5 py-1 font-medium text-gray-500 transition hover:bg-ui-subtle"
                          onClick={clearKpiSelection}
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <Input
                    {...mt}
                    label="Search KPIs"
                    value={kpiAssignSearch}
                    onChange={(e) => setKpiAssignSearch(e.target.value)}
                    crossOrigin=""
                  />
                  <div className="mt-3 min-h-[20rem] max-h-[32rem] overflow-y-auto rounded-lg border border-ui-border bg-white shadow-inner">
                    {assignmentKpisQuery.isLoading ? (
                      <p className="px-4 py-12 text-center text-sm text-gray-500">Loading KPIs…</p>
                    ) : filteredAssignmentKpis.length === 0 ? (
                      <p className="px-4 py-12 text-center text-sm text-gray-500">
                        {kpiAssignSearch.trim()
                          ? `No KPIs match “${kpiAssignSearch.trim()}”.`
                          : 'No active KPIs in the catalog yet.'}
                      </p>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {filteredAssignmentKpis.map((kpi) => {
                          const kpiId = String(kpi.id)
                          const checked = assignForm.kpi_ids.includes(kpiId)
                          const title = kpi.short_name || kpi.indicator_statement.slice(0, 80)
                          return (
                            <li key={kpiId}>
                              <label
                                className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors ${
                                  checked ? 'bg-moh-green/[0.08]' : 'hover:bg-moh-green/[0.04]'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleAssignKpi(kpiId)}
                                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-moh-green focus:ring-moh-green"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-medium text-ui-text">
                                    <span className="font-mono text-xs text-moh-green">{kpi.kpi_code}</span>
                                    <span className="mx-1.5 text-gray-300">·</span>
                                    {title}
                                  </span>
                                  {kpi.subject_area_name ? (
                                    <span className="mt-0.5 block text-xs text-gray-500">
                                      {kpi.subject_area_name}
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                  <Typography {...mt} className="mt-2 text-xs text-gray-500">
                    {assignmentKpis.length} active KPI{assignmentKpis.length === 1 ? '' : 's'} in catalog
                  </Typography>
                </div>

                <div className="p-5">
                  <Typography {...mt} className="mb-3 text-sm font-semibold text-ui-text">
                    Assign to
                  </Typography>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {ASSIGN_LEVELS.map((level) => {
                      const Icon = level.icon
                      const active = assignForm.assignable_type === level.id
                      return (
                        <button
                          key={level.id}
                          type="button"
                          onClick={() =>
                            setAssignForm((f) => ({
                              ...f,
                              assignable_type: level.id,
                            }))
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            active
                              ? 'border-moh-green bg-moh-green text-white shadow-sm'
                              : 'border-ui-border bg-white text-gray-600 hover:border-moh-green/40 hover:text-moh-green'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {level.label}
                        </button>
                      )
                    })}
                  </div>

                  {activeAssignLevel ? (
                    <p className="mb-4 rounded-md border border-dashed border-moh-green/25 bg-moh-green/[0.03] px-3 py-2 text-xs text-gray-600">
                      {activeAssignLevel.hint}
                    </p>
                  ) : null}

                  <div className="space-y-4">
                    {assignForm.assignable_type === 'facility_type' ? (
                      <SearchableSelect
                        label="Facility type"
                        value={assignForm.facility_type_ref_id}
                        onChange={(v) => setAssignForm((f) => ({ ...f, facility_type_ref_id: v }))}
                        options={targetOptionsToSelect(assignmentTargets?.facility_types)}
                        emptyLabel="— Select facility type —"
                        placeholder="Search facility types…"
                      />
                    ) : null}

                    {assignForm.assignable_type === 'facility' ? (
                      <SearchableSelect
                        label="Facility"
                        value={assignForm.facility_id}
                        onChange={(v) => setAssignForm((f) => ({ ...f, facility_id: v }))}
                        options={targetOptionsToSelect(assignmentTargets?.facilities)}
                        emptyLabel="— Select facility —"
                        placeholder="Search facilities…"
                      />
                    ) : null}

                    {assignForm.assignable_type === 'department' ? (
                      <SearchableSelect
                        label="Department"
                        value={assignForm.department_id}
                        onChange={(v) => setAssignForm((f) => ({ ...f, department_id: v }))}
                        options={targetOptionsToSelect(assignmentTargets?.departments)}
                        emptyLabel="— Select department —"
                        placeholder="Search departments…"
                      />
                    ) : null}

                    {assignForm.assignable_type === 'job' ? (
                      <SearchableSelect
                        label="Job title"
                        value={assignForm.job_id}
                        onChange={(v) => setAssignForm((f) => ({ ...f, job_id: v }))}
                        options={targetOptionsToSelect(assignmentTargets?.jobs)}
                        emptyLabel="— Select job title —"
                        placeholder="Search job titles…"
                      />
                    ) : null}

                    {assignForm.assignable_type === 'staff' ? (
                      <>
                        <Input
                          {...mt}
                          label="Search staff"
                          value={assignForm.staff_search}
                          onChange={(e) =>
                            setAssignForm((f) => ({ ...f, staff_search: e.target.value, staff_id: '' }))
                          }
                          crossOrigin=""
                        />
                        <SearchableSelect
                          label="Staff member"
                          value={assignForm.staff_id}
                          onChange={(v) => setAssignForm((f) => ({ ...f, staff_id: v }))}
                          options={staffSelectOptions}
                          emptyLabel="— Select staff —"
                          placeholder="Search staff…"
                          disabled={staffQuery.isLoading && staffOptions.length === 0}
                        />
                      </>
                    ) : null}
                  </div>

                  {assignmentTargetsQuery.isLoading ? (
                    <p className="mt-4 text-xs text-gray-500">Loading assignment targets…</p>
                  ) : null}

                  <Button
                    {...mt}
                    size="md"
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-moh-green py-3 shadow-sm"
                    disabled={!canSubmitAssignment || assignMutation.isPending}
                    onClick={() => assignMutation.mutate()}
                  >
                    <Link2 className="h-4 w-4" />
                    {assignForm.kpi_ids.length > 1
                      ? `Assign ${assignForm.kpi_ids.length} KPIs`
                      : 'Assign KPI'}
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}

          <Card {...mt} className="mb-4 rounded-sm border border-ui-border p-4">
            <div className="flex flex-wrap items-end gap-3">
              <Input
                {...mt}
                label="Search assignments"
                value={assignmentSearch}
                onChange={(e) => {
                  setAssignmentSearch(e.target.value)
                  setAssignmentPage(1)
                }}
                className="min-w-[200px] flex-1"
              />
              <Select
                {...mt}
                label="Assignment type"
                value={assignmentTypeFilter}
                onChange={(v) => {
                  setAssignmentTypeFilter(v ?? '')
                  setAssignmentPage(1)
                }}
                className="min-w-[160px]"
              >
                <Option value="">All types</Option>
                <Option value="facility_type">Facility type</Option>
                <Option value="facility">Facility</Option>
                <Option value="department">Department</Option>
                <Option value="job">Job title</Option>
                <Option value="staff">Individual</Option>
              </Select>
            </div>
          </Card>

          <QueryState
            isLoading={assignmentsQuery.isLoading}
            isError={assignmentsQuery.isError}
            error={assignmentsQuery.error}
            label="KPI assignments"
            variant="table"
            onRetry={() => assignmentsQuery.refetch()}
          >
            <ServerPaginatedTable
              columns={[
                { key: 'kpi', label: 'KPI' },
                { key: 'type', label: 'Type' },
                { key: 'target', label: 'Target' },
                { key: 'status', label: 'Status' },
                ...(canManageAssignments ? [{ key: 'actions', label: '' }] : []),
              ]}
              rows={assignments}
              pagination={assignmentPagination}
              onPageChange={setAssignmentPage}
              rowKey={(row) => row.id}
              renderRow={(row: KpiAssignmentRow) => (
                <>
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.kpi_name}</div>
                    <div className="text-xs text-gray-500">{row.kpi_code}</div>
                  </td>
                  <td className="px-3 py-2">{assignTypeLabel(row.assignable_type)}</td>
                  <td className="px-3 py-2">{assignmentTargetLabel(row)}</td>
                  <td className="px-3 py-2">
                    {row.is_active ? (
                      <span className="text-moh-green">Active</span>
                    ) : (
                      <span className="text-gray-400">Inactive</span>
                    )}
                  </td>
                  {canManageAssignments && row.is_active ? (
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                        onClick={() => removeAssignmentMutation.mutate(row.id)}
                        aria-label="Remove assignment"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </td>
                  ) : null}
                </>
              )}
            />
          </QueryState>
        </>
      ) : null}

      {tab === 'permissions' ? (
        <Card {...mt} className="rounded-sm border border-ui-border p-4">
          <Typography {...mt} className="mb-4 text-sm font-bold uppercase text-moh-green">
            KPI permission model
          </Typography>
          <p className="mb-4 text-sm text-gray-600">
            Administrators have full KPI access by default. HR officers receive all KPI permissions on seed.
            Use <Link to="/admin/rbac" className="font-medium text-moh-green underline">Access Control</Link> to
            grant or revoke permissions for other roles.
          </p>
          <div className="space-y-3">
            {(permissionsQuery.data?.permissions ?? []).map((p) => (
              <div
                key={p.code}
                className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 py-2"
              >
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.description}</p>
                </div>
                <Chip
                  {...mt}
                  size="sm"
                  value={hasPermission(p.code) ? 'Granted' : 'Not granted'}
                  className="rounded-sm"
                  color={hasPermission(p.code) ? 'green' : 'gray'}
                />
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  )
}

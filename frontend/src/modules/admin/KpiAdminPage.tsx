import { useState } from 'react'
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
  Search,
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
import { SearchableMultiSelect } from '@/components/molecules/SearchableMultiSelect'
import { kpiAdminService, type KpiAssignmentRow, type KpiRow } from '@/api/services/kpiAdmin'
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
    description: 'Map mandatory KPIs to job titles, optional pools to departments, and individual overrides to staff.',
    actor: 'HR Officer',
  },
  {
    title: 'Staff build their PPA',
    description: 'Assigned KPIs appear grouped by function on the Performance page when employees plan their year.',
    actor: 'Employee',
  },
]

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
    assignable_type: 'job',
    job_id: '',
    department_id: '',
    staff_id: '',
    staff_search: '',
  })

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
        per_page: 500,
      }),
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

  const jobsQuery = useQuery({
    queryKey: ['admin', 'kpi', 'jobs'],
    queryFn: () => kpiAdminService.listJobs(),
    enabled: canManageAssignments,
  })

  const departmentsQuery = useQuery({
    queryKey: ['admin', 'kpi', 'departments'],
    queryFn: () => kpiAdminService.listDepartments(),
    enabled: canManageAssignments,
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
  const jobs = jobsQuery.data ?? []
  const departments = departmentsQuery.data ?? []
  const staffOptions = staffQuery.data ?? []
  const assignmentKpis = assignmentKpisQuery.data?.data ?? []
  const assignmentKpiOptions = assignmentKpis.map((k) => ({
    value: String(k.id),
    label: `${k.kpi_code} — ${k.short_name || k.indicator_statement.slice(0, 48)}`,
    description: k.subject_area_name,
  }))
  const assignTargetReady =
    (assignForm.assignable_type === 'job' && Boolean(assignForm.job_id)) ||
    (assignForm.assignable_type === 'department' && Boolean(assignForm.department_id)) ||
    (assignForm.assignable_type === 'staff' && Boolean(assignForm.staff_id))
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
        subtitle="Catalog indicators and assign them to jobs, departments, and staff"
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
                  icon={<Search className="h-4 w-4" />}
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
            <Card {...mt} className="mb-4 rounded-sm border border-ui-border p-4">
              <div className="mb-4 flex items-center gap-2">
                <Plus className="h-4 w-4 text-moh-green" />
                <Typography {...mt} className="text-sm font-bold uppercase text-ui-text">
                  New assignment
                </Typography>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="md:col-span-2 lg:col-span-3">
                  <SearchableMultiSelect
                    label="KPIs"
                    values={assignForm.kpi_ids}
                    options={assignmentKpiOptions}
                    onChange={(kpi_ids) => setAssignForm((f) => ({ ...f, kpi_ids }))}
                    placeholder="Search KPIs to assign…"
                    emptyLabel="— Select one or more KPIs —"
                  />
                  {assignForm.kpi_ids.length > 0 ? (
                    <Typography {...mt} variant="small" className="mt-1 text-gray-500">
                      {assignForm.kpi_ids.length} KPI{assignForm.kpi_ids.length === 1 ? '' : 's'} selected
                    </Typography>
                  ) : null}
                </div>
                <Select
                  {...mt}
                  label="Assign to"
                  value={assignForm.assignable_type}
                  onChange={(v) =>
                    setAssignForm((f) => ({
                      ...f,
                      assignable_type: v ?? 'job',
                      job_id: '',
                      department_id: '',
                      staff_id: '',
                    }))
                  }
                >
                  <Option value="job">
                    <span className="flex items-center gap-2">
                      <Briefcase className="h-3.5 w-3.5" />
                      Job title (mandatory)
                    </span>
                  </Option>
                  <Option value="department">
                    <span className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5" />
                      Department pool
                    </span>
                  </Option>
                  <Option value="staff">
                    <span className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5" />
                      Individual staff
                    </span>
                  </Option>
                </Select>
                {assignForm.assignable_type === 'job' ? (
                  <Select
                    {...mt}
                    label="Job title"
                    value={assignForm.job_id}
                    onChange={(v) => setAssignForm((f) => ({ ...f, job_id: v ?? '' }))}
                  >
                    <Option value="">— Select job —</Option>
                    {jobs.map((j) => (
                      <Option key={j.id} value={String(j.id)}>
                        {j.job_title}
                      </Option>
                    ))}
                  </Select>
                ) : null}
                {assignForm.assignable_type === 'department' ? (
                  <Select
                    {...mt}
                    label="Department"
                    value={assignForm.department_id}
                    onChange={(v) => setAssignForm((f) => ({ ...f, department_id: v ?? '' }))}
                  >
                    <Option value="">— Select department —</Option>
                    {departments.map((d) => (
                      <Option key={d.id} value={String(d.id)}>
                        {d.name}
                      </Option>
                    ))}
                  </Select>
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
                    />
                    <Select
                      {...mt}
                      label="Staff member"
                      value={assignForm.staff_id}
                      onChange={(v) => setAssignForm((f) => ({ ...f, staff_id: v ?? '' }))}
                    >
                      <Option value="">— Select staff —</Option>
                      {staffOptions.map((s) => (
                        <Option key={s.staff_id} value={String(s.staff_id)}>
                          {s.name} {s.email ? `(${s.email})` : ''}
                        </Option>
                      ))}
                    </Select>
                  </>
                ) : null}
              </div>
              <Button
                {...mt}
                size="sm"
                className="mt-4 flex items-center gap-2 rounded-sm bg-moh-green"
                disabled={!canSubmitAssignment || assignMutation.isPending}
                onClick={() => assignMutation.mutate()}
              >
                <Link2 className="h-4 w-4" />
                {assignForm.kpi_ids.length > 1
                  ? `Assign ${assignForm.kpi_ids.length} KPIs`
                  : 'Assign KPI'}
              </Button>
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
                icon={<Search className="h-4 w-4" />}
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
                <Option value="job">Job</Option>
                <Option value="department">Department</Option>
                <Option value="staff">Individual staff</Option>
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
                  <td className="px-3 py-2 capitalize">{row.assignable_type}</td>
                  <td className="px-3 py-2">
                    {row.job_title || row.department_name || row.staff_name || '—'}
                  </td>
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

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Chip, Input, Typography } from '@material-tailwind/react'
import { Select, Option } from '@/components/molecules/MtSelect'
import { staffManagementService } from '@/api/services/admin'
import type { StaffListRow } from '@/utils/normalizeApi'
import { SearchableSelect } from '@/components/molecules/SearchableSelect'
import { PageHeader } from '@/components/organisms/PageHeader'
import { QueryState } from '@/components/organisms/QueryState'
import { ServerPaginatedTable } from '@/components/organisms/ServerPaginatedTable'
import { useAdminPageSize } from '@/hooks/useAdminPageSize'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { mt } from '@/utils/mt'
import { notifyApiError, toast } from '@/features/toast'

type SupervisorForm = {
  supervisor1: string
  supervisor2: string
  supervisor3: string
}

const EMPTY_SUPERVISOR_FORM: SupervisorForm = {
  supervisor1: '',
  supervisor2: '',
  supervisor3: '',
}

function supervisorLabel(sequence: number) {
  if (sequence === 1) return 'Supervisor 1 (required)'
  return `Supervisor ${sequence} (optional)`
}

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

export function StaffManagementPage() {
  const queryClient = useQueryClient()
  const pageSize = useAdminPageSize()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 400)
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [supervisorFilter, setSupervisorFilter] = useState('')
  const [page, setPage] = useState(1)
  const [activeStaff, setActiveStaff] = useState<StaffListRow | null>(null)
  const [supervisorForm, setSupervisorForm] = useState<SupervisorForm>(EMPTY_SUPERVISOR_FORM)
  const [supervisorFormReady, setSupervisorFormReady] = useState(false)
  const [formError, setFormError] = useState('')
  const [hrForm, setHrForm] = useState({
    hr_department_id: '',
    hr_email: '',
    hr_mobile: '',
    notes: '',
  })

  const listQuery = useQuery({
    queryKey: ['admin', 'staff', debouncedSearch, departmentFilter, supervisorFilter, page, pageSize],
    queryFn: () =>
      staffManagementService.list({
        search: debouncedSearch || undefined,
        department_id: departmentFilter ? Number(departmentFilter) : undefined,
        has_supervisor: supervisorFilter || undefined,
        page,
        per_page: pageSize,
      }),
  })

  const departmentsQuery = useQuery({
    queryKey: ['admin', 'departments'],
    queryFn: () => staffManagementService.listDepartments(),
  })

  const candidatesQuery = useQuery({
    queryKey: ['admin', 'supervisor-candidates'],
    queryFn: () => staffManagementService.listSupervisorCandidates(),
    enabled: !!activeStaff,
    staleTime: 60_000,
  })

  const supervisorsQuery = useQuery({
    queryKey: ['admin', 'staff', activeStaff?.staff_id, 'supervisors'],
    queryFn: () => staffManagementService.getSupervisors(activeStaff!.staff_id),
    enabled: !!activeStaff,
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const staffId = activeStaff!.staff_id
      const slots: { sequence: number; supervisor_staff_id: number }[] = []
      if (supervisorForm.supervisor1) {
        slots.push({ sequence: 1, supervisor_staff_id: Number(supervisorForm.supervisor1) })
      }
      if (supervisorForm.supervisor2) {
        slots.push({ sequence: 2, supervisor_staff_id: Number(supervisorForm.supervisor2) })
      }
      if (supervisorForm.supervisor3) {
        slots.push({ sequence: 3, supervisor_staff_id: Number(supervisorForm.supervisor3) })
      }

      await staffManagementService.updateHrProfile(staffId, {
        hr_department_id: hrForm.hr_department_id ? Number(hrForm.hr_department_id) : undefined,
        hr_email: hrForm.hr_email,
        hr_mobile: hrForm.hr_mobile,
        notes: hrForm.notes,
      })
      await staffManagementService.setSupervisors(staffId, slots)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] })
      toast.success('Staff record saved successfully.')
      closeStaffModal()
    },
    onError: (error: unknown) => {
      const message = apiErrorMessage(error, 'Could not save staff record')
      setFormError(message)
      notifyApiError(error, 'Could not save staff record')
    },
  })

  const openStaffModal = (row: StaffListRow) => {
    setActiveStaff(row)
    setFormError('')
    setSupervisorForm(EMPTY_SUPERVISOR_FORM)
    setSupervisorFormReady(false)
    setHrForm({
      hr_department_id: row.hr_department_id ? String(row.hr_department_id) : '',
      hr_email: row.email ?? '',
      hr_mobile: row.mobile ?? '',
      notes: '',
    })
  }

  const closeStaffModal = () => {
    setActiveStaff(null)
    setSupervisorForm(EMPTY_SUPERVISOR_FORM)
    setSupervisorFormReady(false)
    setFormError('')
  }

  useEffect(() => {
    if (!activeStaff || !supervisorsQuery.isSuccess || supervisorFormReady) return
    const bySequence = Object.fromEntries(
      (supervisorsQuery.data ?? []).map((sup) => [sup.sequence, String(sup.supervisor_staff_id)]),
    )
    setSupervisorForm({
      supervisor1: bySequence[1] ?? '',
      supervisor2: bySequence[2] ?? '',
      supervisor3: bySequence[3] ?? '',
    })
    setSupervisorFormReady(true)
  }, [activeStaff, supervisorsQuery.isSuccess, supervisorsQuery.data, supervisorFormReady])

  const rows = listQuery.data?.data ?? []
  const pagination = listQuery.data ?? { total: 0, page: 1, per_page: pageSize, total_pages: 1 }
  const departments = departmentsQuery.data ?? []
  const candidates = candidatesQuery.data ?? []
  const unassignedOnPage = rows.filter((row) => !row.has_supervisor).length

  const departmentOptions = useMemo(
    () =>
      departments.map((d) => ({
        value: String(d.id),
        label: d.name,
      })),
    [departments],
  )

  const supervisorOptions = useMemo(
    () =>
      candidates
        .filter((candidate) => !(activeStaff && candidate.staff_id === activeStaff.staff_id))
        .map((candidate) => ({
          value: String(candidate.staff_id),
          label: candidate.name,
          description: candidate.job_title,
        })),
    [candidates, activeStaff],
  )

  const applyFilters = () => {
    setPage(1)
    listQuery.refetch()
  }

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, departmentFilter, supervisorFilter])

  const validateForm = () => {
    if (!supervisorForm.supervisor1) {
      setFormError('Supervisor 1 is required.')
      return false
    }
    const selected = [
      supervisorForm.supervisor1,
      supervisorForm.supervisor2,
      supervisorForm.supervisor3,
    ].filter(Boolean)
    if (new Set(selected).size !== selected.length) {
      setFormError('Each supervisor must be a different person.')
      return false
    }
    if (supervisorForm.supervisor3 && !supervisorForm.supervisor2) {
      setFormError('Assign Supervisor 2 before Supervisor 3.')
      return false
    }
    setFormError('')
    return true
  }

  const saveStaff = () => {
    if (!validateForm()) return
    saveMutation.mutate()
  }

  return (
    <div>
      <PageHeader
        title="Staff Management"
        subtitle="Manage HR profiles and supervisor assignments in one place"
      />

      {supervisorFilter === 'false' || unassignedOnPage > 0 ? (
        <Card {...mt} className="mb-4 rounded-sm border border-moh-warning/30 bg-moh-warning/5 p-4">
          <Typography {...mt} className="text-sm">
            Staff without a primary supervisor cannot submit leave or out-of-station requests.
            {supervisorFilter !== 'false' && unassignedOnPage > 0 ? (
              <>
                {' '}
                <strong>{unassignedOnPage}</strong> on this page still need Supervisor 1 assigned.
              </>
            ) : null}
          </Typography>
        </Card>
      ) : null}

      <Card {...mt} className="mb-4 rounded-sm border border-moh-green/15 p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Input
            {...mt}
            label="Search staff"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          />
          <Select
            {...mt}
            label="Department"
            value={departmentFilter}
            onChange={(v) => {
              setDepartmentFilter(v ?? '')
              setPage(1)
            }}
          >
            <Option value="">All departments</Option>
            {departments.map((d) => (
              <Option key={d.id} value={String(d.id)}>
                {d.name}
              </Option>
            ))}
          </Select>
          <Select
            {...mt}
            label="Supervisor status"
            value={supervisorFilter}
            onChange={(v) => {
              setSupervisorFilter(v ?? '')
              setPage(1)
            }}
          >
            <Option value="">All staff</Option>
            <Option value="true">Has supervisor</Option>
            <Option value="false">No supervisor</Option>
          </Select>
          <div className="flex items-end gap-2">
            <Button {...mt} size="sm" className="rounded-sm bg-moh-green" onClick={applyFilters}>
              Apply filters
            </Button>
            <Button
              {...mt}
              size="sm"
              variant="outlined"
              onClick={() => {
                setSearch('')
                setDepartmentFilter('')
                setSupervisorFilter('')
                setPage(1)
              }}
            >
              Clear
            </Button>
          </div>
        </div>
        <Typography {...mt} className="mt-2 text-xs text-gray-500">
          {pagination.total} matching record{pagination.total === 1 ? '' : 's'} · {pageSize} per page
        </Typography>
      </Card>

      <QueryState
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        error={listQuery.error}
        label="staff records"
        variant="table"
        onRetry={() => listQuery.refetch()}
      >
        <ServerPaginatedTable
          title="Staff directory"
          description="iHRIS-synced staff with HR overrides and up to 3 supervisors"
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'facility', label: 'Facility / Job' },
            { key: 'department', label: 'Department' },
            { key: 'hr', label: 'HR Dept' },
            { key: 'supervisor', label: 'Supervisors' },
            { key: 'actions', label: '' },
          ]}
          rows={rows}
          pagination={pagination}
          onPageChange={setPage}
          rowKey={(row) => row.staff_id}
          renderRow={(row) => (
            <>
              <td className="px-3 py-2">
                <div className="font-medium">{row.name}</div>
                <div className="text-xs text-gray-500">{row.ihris_pid}</div>
              </td>
              <td className="px-3 py-2">{row.email || '—'}</td>
              <td className="px-3 py-2">
                <div>{row.facility_name}</div>
                <div className="text-xs text-gray-500">{row.job_title}</div>
              </td>
              <td className="px-3 py-2">{row.department_name || '—'}</td>
              <td className="px-3 py-2">{row.hr_department_name || '—'}</td>
              <td className="px-3 py-2">
                {row.supervisors?.length ? (
                  <div className="flex flex-wrap gap-1">
                    {row.supervisors.map((sup) => (
                      <Chip
                        key={sup.sequence}
                        {...mt}
                        size="sm"
                        variant="ghost"
                        value={`S${sup.sequence}: ${sup.supervisor_name ?? '—'}`}
                        className="rounded-sm bg-moh-green/10 text-xs text-moh-green"
                      />
                    ))}
                  </div>
                ) : (
                  <span className="font-medium text-amber-700">No supervisor</span>
                )}
              </td>
              <td className="px-3 py-2">
                <Button {...mt} size="sm" variant="text" onClick={() => openStaffModal(row)}>
                  Manage
                </Button>
              </td>
            </>
          )}
        />
      </QueryState>

      {activeStaff ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeStaffModal}
          onKeyDown={(e) => e.key === 'Escape' && closeStaffModal()}
          role="presentation"
        >
          <Card
            {...mt}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-sm border border-moh-green/20 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Typography {...mt} className="text-lg font-bold text-moh-green">
              Manage staff record
            </Typography>
            <Typography {...mt} className="mt-1 text-sm text-gray-600">
              {activeStaff.name} · {activeStaff.job_title}
            </Typography>
            <Typography {...mt} className="mt-1 text-xs text-gray-500">
              {activeStaff.facility_name}
              {activeStaff.ihris_pid ? ` · ${activeStaff.ihris_pid}` : ''}
            </Typography>

            <div className="mt-6 border-t border-gray-200 pt-6">
              <Typography {...mt} className="text-sm font-bold uppercase tracking-wide text-moh-green">
                HR profile enrichment
              </Typography>
              <Typography {...mt} className="mt-1 text-xs text-gray-500">
                Override iHRIS values where needed. Field protection during sync is controlled under{' '}
                <strong>Administration → System configuration</strong> (overwrite disabled by default).
              </Typography>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <SearchableSelect
                  label="HR department (if missing from iHRIS)"
                  value={hrForm.hr_department_id}
                  placeholder="Search departments…"
                  emptyLabel="— None —"
                  options={departmentOptions}
                  onChange={(v) => setHrForm((f) => ({ ...f, hr_department_id: v }))}
                />
                <Input
                  {...mt}
                  label="HR email override"
                  value={hrForm.hr_email}
                  onChange={(e) => setHrForm((f) => ({ ...f, hr_email: e.target.value }))}
                />
                <Input
                  {...mt}
                  label="HR mobile override"
                  value={hrForm.hr_mobile}
                  onChange={(e) => setHrForm((f) => ({ ...f, hr_mobile: e.target.value }))}
                />
                <Input
                  {...mt}
                  label="Notes"
                  value={hrForm.notes}
                  onChange={(e) => setHrForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-8 border-t border-gray-200 pt-6">
              <Typography {...mt} className="text-sm font-bold uppercase tracking-wide text-moh-green">
                Supervisors
              </Typography>
              <Typography {...mt} className="mt-1 text-xs text-gray-500">
                Supervisor 1 is required for leave and travel approvals. Add up to two more for sequential
                sign-off. Type a name or job title to filter each list.
              </Typography>

              <div className="mt-5 space-y-5">
                {([1, 2, 3] as const).map((sequence) => {
                  const field = `supervisor${sequence}` as keyof SupervisorForm
                  const selectedOthers = ([1, 2, 3] as const)
                    .filter((slot) => slot !== sequence)
                    .map((slot) => supervisorForm[`supervisor${slot}` as keyof SupervisorForm])
                    .filter(Boolean)

                  return (
                    <SearchableSelect
                      key={sequence}
                      label={supervisorLabel(sequence)}
                      value={supervisorForm[field]}
                      placeholder={
                        sequence === 1 ? 'Search primary supervisor…' : 'Search supervisor…'
                      }
                      emptyLabel={sequence === 1 ? 'Select primary supervisor' : '— None —'}
                      options={supervisorOptions.filter(
                        (candidate) => !selectedOthers.includes(candidate.value),
                      )}
                      onChange={(v) => {
                        setSupervisorForm((prev) => ({ ...prev, [field]: v }))
                        setFormError('')
                      }}
                    />
                  )
                })}
              </div>

              {supervisorsQuery.isLoading ? (
                <Typography {...mt} className="mt-4 text-xs text-gray-500">
                  Loading current supervisors…
                </Typography>
              ) : null}
            </div>

            {formError ? (
              <Typography {...mt} className="mt-5 text-sm text-red-600">
                {formError}
              </Typography>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-3 border-t border-gray-200 pt-6">
              <Button
                {...mt}
                size="sm"
                className="rounded-sm bg-moh-green"
                onClick={saveStaff}
                loading={saveMutation.isPending}
                disabled={supervisorsQuery.isLoading}
              >
                Save changes
              </Button>
              <Button {...mt} size="sm" variant="outlined" onClick={closeStaffModal}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  )
}

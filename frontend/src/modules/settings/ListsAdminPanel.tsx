import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { Building2, Briefcase, Layers, MapPin, Plus, Users } from 'lucide-react'
import {
  listsAdminService,
  type DepartmentListRow,
  type DistrictListRow,
  type FacilityListRow,
  type JobTitleListRow,
  type RegionListRow,
} from '@/api/services/listsAdmin'
import { QueryState } from '@/components/organisms/QueryState'
import { ServerPaginatedTable } from '@/components/organisms/ServerPaginatedTable'
import { useAdminPageSize } from '@/hooks/useAdminPageSize'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { mt } from '@/utils/mt'

type ListTab = 'regions' | 'districts' | 'facilities' | 'departments' | 'job-titles'

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

function SummaryCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <Card {...mt} className="rounded-sm border border-moh-green/15 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-sm bg-moh-green/10 p-2 text-moh-green">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
          <p className="text-xl font-bold text-ui-text">{value.toLocaleString()}</p>
        </div>
      </div>
    </Card>
  )
}

export function ListsAdminPanel() {
  const queryClient = useQueryClient()
  const pageSize = useAdminPageSize()
  const [tab, setTab] = useState<ListTab>('regions')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [regionFilter, setRegionFilter] = useState('')
  const [districtFilter, setDistrictFilter] = useState('')
  const [page, setPage] = useState(1)
  const [editError, setEditError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', external_id: '' })

  const [editRegion, setEditRegion] = useState<RegionListRow | null>(null)
  const [editDistrict, setEditDistrict] = useState<DistrictListRow | null>(null)
  const [editFacility, setEditFacility] = useState<FacilityListRow | null>(null)
  const [editDepartment, setEditDepartment] = useState<DepartmentListRow | null>(null)
  const [editJobTitle, setEditJobTitle] = useState<JobTitleListRow | null>(null)

  const summaryQuery = useQuery({
    queryKey: ['admin', 'lists', 'summary'],
    queryFn: () => listsAdminService.summary(),
  })

  const regionOptionsQuery = useQuery({
    queryKey: ['admin', 'lists', 'region-options'],
    queryFn: () => listsAdminService.regionOptions(),
  })

  const districtOptionsQuery = useQuery({
    queryKey: ['admin', 'lists', 'district-options'],
    queryFn: () => listsAdminService.districtOptions(),
  })

  const regionsQuery = useQuery({
    queryKey: ['admin', 'lists', 'regions', debouncedSearch, page, pageSize],
    queryFn: () =>
      listsAdminService.listRegions({ search: debouncedSearch || undefined, page, per_page: pageSize }),
    enabled: tab === 'regions',
  })

  const districtsQuery = useQuery({
    queryKey: ['admin', 'lists', 'districts', debouncedSearch, regionFilter, page, pageSize],
    queryFn: () =>
      listsAdminService.listDistricts({
        search: debouncedSearch || undefined,
        region_id: regionFilter ? Number(regionFilter) : undefined,
        page,
        per_page: pageSize,
      }),
    enabled: tab === 'districts',
  })

  const facilitiesQuery = useQuery({
    queryKey: ['admin', 'lists', 'facilities', debouncedSearch, regionFilter, districtFilter, page, pageSize],
    queryFn: () =>
      listsAdminService.listFacilities({
        search: debouncedSearch || undefined,
        region_id: regionFilter ? Number(regionFilter) : undefined,
        district_id: districtFilter ? Number(districtFilter) : undefined,
        page,
        per_page: pageSize,
      }),
    enabled: tab === 'facilities',
  })

  const departmentsQuery = useQuery({
    queryKey: ['admin', 'lists', 'departments', debouncedSearch, page, pageSize],
    queryFn: () =>
      listsAdminService.listDepartments({ search: debouncedSearch || undefined, page, per_page: pageSize }),
    enabled: tab === 'departments',
  })

  const jobTitlesQuery = useQuery({
    queryKey: ['admin', 'lists', 'job-titles', debouncedSearch, page, pageSize],
    queryFn: () =>
      listsAdminService.listJobTitles({ search: debouncedSearch || undefined, page, per_page: pageSize }),
    enabled: tab === 'job-titles',
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'lists'] })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editRegion) {
        await listsAdminService.updateRegion(editRegion.id, {
          name: editRegion.name,
          code: editRegion.code,
          external_system_id: editRegion.external_system_id || null,
          iso_code: editRegion.iso_code || null,
          is_active: editRegion.is_active,
        })
      } else if (editDistrict) {
        await listsAdminService.updateDistrict(editDistrict.id, {
          name: editDistrict.name,
          code: editDistrict.code,
          region_id: editDistrict.region_id || null,
          ihris_district_id: editDistrict.ihris_district_id || null,
          iso_code: editDistrict.iso_code,
          is_active: editDistrict.is_active,
        })
      } else if (editFacility) {
        await listsAdminService.updateFacility(editFacility.id, {
          name: editFacility.name,
          district_ref_id: editFacility.district_ref_id || null,
          region_id: editFacility.region_id || null,
          latitude: editFacility.latitude ?? null,
          longitude: editFacility.longitude ?? null,
          is_active: editFacility.is_active,
        })
      } else if (editDepartment) {
        await listsAdminService.updateDepartment(editDepartment.id, {
          name: editDepartment.name,
          external_system_id: editDepartment.external_system_id,
        })
      } else if (editJobTitle) {
        await listsAdminService.updateJobTitle(editJobTitle.id, {
          job_title: editJobTitle.job_title,
          external_job_id: editJobTitle.external_job_id,
        })
      }
    },
    onSuccess: () => {
      setEditError('')
      closeEdit()
      invalidate()
    },
    onError: (error: unknown) => setEditError(apiErrorMessage(error, 'Could not save record')),
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      if (tab === 'departments') {
        await listsAdminService.createDepartment({
          name: createForm.name,
          external_system_id: createForm.external_id || undefined,
        })
      } else if (tab === 'job-titles') {
        await listsAdminService.createJobTitle({
          job_title: createForm.name,
          external_job_id: createForm.external_id || undefined,
        })
      }
    },
    onSuccess: () => {
      setCreateOpen(false)
      setCreateForm({ name: '', external_id: '' })
      invalidate()
    },
    onError: (error: unknown) => setEditError(apiErrorMessage(error, 'Could not create record')),
  })

  const closeEdit = () => {
    setEditRegion(null)
    setEditDistrict(null)
    setEditFacility(null)
    setEditDepartment(null)
    setEditJobTitle(null)
    setEditError('')
  }

  useEffect(() => {
    setPage(1)
    setSearch('')
    setRegionFilter('')
    setDistrictFilter('')
    setCreateOpen(false)
    closeEdit()
  }, [tab])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, regionFilter, districtFilter])

  const summary = summaryQuery.data
  const regionOptions = regionOptionsQuery.data ?? []
  const districtOptions = districtOptionsQuery.data ?? []

  const activeQuery =
    tab === 'regions'
      ? regionsQuery
      : tab === 'districts'
        ? districtsQuery
        : tab === 'facilities'
          ? facilitiesQuery
          : tab === 'departments'
            ? departmentsQuery
            : jobTitlesQuery

  const toolbar = (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      <Input
        {...mt}
        label="Search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        crossOrigin=""
      />
      {tab === 'districts' || tab === 'facilities' ? (
        <Select
          {...mt}
          label="Region"
          value={regionFilter}
          onChange={(v) => setRegionFilter((v as string) ?? '')}
        >
          <Option value="">All regions</Option>
          {regionOptions.map((r) => (
            <Option key={r.id} value={String(r.id)}>
              {r.name}
            </Option>
          ))}
        </Select>
      ) : null}
      {tab === 'facilities' ? (
        <Select
          {...mt}
          label="District"
          value={districtFilter}
          onChange={(v) => setDistrictFilter((v as string) ?? '')}
        >
          <Option value="">All districts</Option>
          {districtOptions
            .filter((d) => !regionFilter || String(d.region_id ?? '') === regionFilter)
            .map((d) => (
              <Option key={d.id} value={String(d.id)}>
                {d.name}
              </Option>
            ))}
        </Select>
      ) : null}
      {tab === 'departments' || tab === 'job-titles' ? (
        <div className="flex items-end">
          <Button
            {...mt}
            size="sm"
            className="flex items-center gap-2 rounded-sm bg-moh-green normal-case"
            onClick={() => {
              setCreateOpen(true)
              setCreateForm({ name: '', external_id: '' })
              setEditError('')
            }}
          >
            <Plus className="h-4 w-4" />
            Add {tab === 'departments' ? 'department' : 'job title'}
          </Button>
        </div>
      ) : null}
    </div>
  )

  return (
    <div className="space-y-6">
      <Card {...mt} className="rounded-sm border border-moh-green/15 p-5 shadow-sm">
        <Typography {...mt} className="text-sm font-bold uppercase tracking-wide text-moh-green">
          Reference lists
        </Typography>
        <p className="mt-2 text-sm text-gray-600">
          Geography hierarchy: <strong>Region → District → Facility</strong>. Organisational lists include
          departments and job titles synced from iHRIS. Edits here are used for data scope assignment and
          reporting — no database constraints are enforced, keeping assignments flexible.
        </p>
        {summary ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard label="Regions" value={summary.regions} icon={Layers} />
            <SummaryCard label="Districts" value={summary.districts} icon={MapPin} />
            <SummaryCard label="Facilities" value={summary.facilities} icon={Building2} />
            <SummaryCard label="Departments" value={summary.departments} icon={Users} />
            <SummaryCard label="Job titles" value={summary.job_titles} icon={Briefcase} />
          </div>
        ) : null}
      </Card>

      <Tabs value={tab}>
        <TabsHeader {...mt} className="rounded-sm bg-moh-background">
          <Tab {...mt} value="regions" onClick={() => setTab('regions')}>
            Regions
          </Tab>
          <Tab {...mt} value="districts" onClick={() => setTab('districts')}>
            Districts
          </Tab>
          <Tab {...mt} value="facilities" onClick={() => setTab('facilities')}>
            Facilities
          </Tab>
          <Tab {...mt} value="departments" onClick={() => setTab('departments')}>
            Departments
          </Tab>
          <Tab {...mt} value="job-titles" onClick={() => setTab('job-titles')}>
            Job titles
          </Tab>
        </TabsHeader>
      </Tabs>

      <QueryState
        isLoading={activeQuery.isLoading}
        isError={activeQuery.isError}
        error={activeQuery.error}
        label="list records"
        variant="table"
        onRetry={() => activeQuery.refetch()}
      >
        {tab === 'regions' && regionsQuery.data ? (
          <ServerPaginatedTable
            title="Regions"
            description="Macro regions — top of the geography hierarchy"
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'code', label: 'Code' },
              { key: 'external', label: 'External ID' },
              { key: 'iso', label: 'ISO' },
              { key: 'districts', label: 'Districts' },
              { key: 'status', label: 'Status' },
              { key: 'actions', label: '' },
            ]}
            rows={regionsQuery.data.data}
            pagination={regionsQuery.data}
            onPageChange={setPage}
            rowKey={(row) => row.id}
            toolbar={toolbar}
            renderRow={(row) => (
              <>
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2">{row.code}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{row.external_system_id || '—'}</td>
                <td className="px-3 py-2">{row.iso_code || '—'}</td>
                <td className="px-3 py-2">{row.district_count}</td>
                <td className="px-3 py-2">
                  <Chip
                    {...mt}
                    size="sm"
                    value={row.is_active ? 'Active' : 'Inactive'}
                    className={row.is_active ? 'bg-moh-green/10 text-moh-green' : 'bg-gray-100'}
                  />
                </td>
                <td className="px-3 py-2">
                  <Button {...mt} size="sm" variant="text" onClick={() => setEditRegion({ ...row })}>
                    Edit
                  </Button>
                </td>
              </>
            )}
          />
        ) : null}

        {tab === 'districts' && districtsQuery.data ? (
          <ServerPaginatedTable
            title="Districts"
            description="Districts belong to a region and contain facilities"
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'code', label: 'Code' },
              { key: 'region', label: 'Region' },
              { key: 'ihris', label: 'iHRIS ID' },
              { key: 'facilities', label: 'Facilities' },
              { key: 'status', label: 'Status' },
              { key: 'actions', label: '' },
            ]}
            rows={districtsQuery.data.data}
            pagination={districtsQuery.data}
            onPageChange={setPage}
            rowKey={(row) => row.id}
            toolbar={toolbar}
            renderRow={(row) => (
              <>
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2">{row.code}</td>
                <td className="px-3 py-2">{row.region_name || row.region || '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{row.ihris_district_id || '—'}</td>
                <td className="px-3 py-2">{row.facility_count}</td>
                <td className="px-3 py-2">
                  <Chip
                    {...mt}
                    size="sm"
                    value={row.is_active ? 'Active' : 'Inactive'}
                    className={row.is_active ? 'bg-moh-green/10 text-moh-green' : 'bg-gray-100'}
                  />
                </td>
                <td className="px-3 py-2">
                  <Button {...mt} size="sm" variant="text" onClick={() => setEditDistrict({ ...row })}>
                    Edit
                  </Button>
                </td>
              </>
            )}
          />
        ) : null}

        {tab === 'facilities' && facilitiesQuery.data ? (
          <ServerPaginatedTable
            title="Facilities"
            description="Health facilities linked to districts (district_ref_id)"
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'ihris', label: 'iHRIS ID' },
              { key: 'district', label: 'District' },
              { key: 'region', label: 'Region' },
              { key: 'coords', label: 'Coordinates' },
              { key: 'status', label: 'Status' },
              { key: 'actions', label: '' },
            ]}
            rows={facilitiesQuery.data.data}
            pagination={facilitiesQuery.data}
            onPageChange={setPage}
            rowKey={(row) => row.id}
            toolbar={toolbar}
            renderRow={(row) => (
              <>
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{row.ihris_facility_id}</td>
                <td className="px-3 py-2">{row.district_name || '—'}</td>
                <td className="px-3 py-2">{row.region_name || '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-500">
                  {row.latitude != null && row.longitude != null
                    ? `${row.latitude}, ${row.longitude}`
                    : '—'}
                </td>
                <td className="px-3 py-2">
                  <Chip
                    {...mt}
                    size="sm"
                    value={row.is_active ? 'Active' : 'Inactive'}
                    className={row.is_active ? 'bg-moh-green/10 text-moh-green' : 'bg-gray-100'}
                  />
                </td>
                <td className="px-3 py-2">
                  <Button {...mt} size="sm" variant="text" onClick={() => setEditFacility({ ...row })}>
                    Edit
                  </Button>
                </td>
              </>
            )}
          />
        ) : null}

        {tab === 'departments' && departmentsQuery.data ? (
          <ServerPaginatedTable
            title="Departments"
            description="Organisational departments linked to facilities during iHRIS sync"
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'facility', label: 'Facility' },
              { key: 'external', label: 'External ID' },
              { key: 'actions', label: '' },
            ]}
            rows={departmentsQuery.data.data}
            pagination={departmentsQuery.data}
            onPageChange={setPage}
            rowKey={(row) => row.id}
            toolbar={toolbar}
            renderRow={(row) => (
              <>
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2 text-sm text-gray-600">{row.facility_name || '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{row.external_system_id}</td>
                <td className="px-3 py-2">
                  <Button {...mt} size="sm" variant="text" onClick={() => setEditDepartment({ ...row })}>
                    Edit
                  </Button>
                </td>
              </>
            )}
          />
        ) : null}

        {tab === 'job-titles' && jobTitlesQuery.data ? (
          <ServerPaginatedTable
            title="Job titles"
            description="Cadre and job catalogue from iHRIS sync"
            columns={[
              { key: 'title', label: 'Job title' },
              { key: 'external', label: 'External job ID' },
              { key: 'actions', label: '' },
            ]}
            rows={jobTitlesQuery.data.data}
            pagination={jobTitlesQuery.data}
            onPageChange={setPage}
            rowKey={(row) => row.id}
            toolbar={toolbar}
            renderRow={(row) => (
              <>
                <td className="px-3 py-2 font-medium">{row.job_title}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{row.external_job_id}</td>
                <td className="px-3 py-2">
                  <Button {...mt} size="sm" variant="text" onClick={() => setEditJobTitle({ ...row })}>
                    Edit
                  </Button>
                </td>
              </>
            )}
          />
        ) : null}
      </QueryState>

      {(editRegion || editDistrict || editFacility || editDepartment || editJobTitle) && (
        <EditModal title="Edit list record" onClose={closeEdit}>
          {editRegion ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Input {...mt} label="Name" value={editRegion.name} onChange={(e) => setEditRegion({ ...editRegion, name: e.target.value })} />
              <Input {...mt} label="Code" value={editRegion.code} onChange={(e) => setEditRegion({ ...editRegion, code: e.target.value })} />
              <Input {...mt} label="External system ID" value={editRegion.external_system_id ?? ''} onChange={(e) => setEditRegion({ ...editRegion, external_system_id: e.target.value })} />
              <Input {...mt} label="ISO code" value={editRegion.iso_code ?? ''} onChange={(e) => setEditRegion({ ...editRegion, iso_code: e.target.value })} />
              <Toggle label="Active" checked={editRegion.is_active} onChange={(checked) => setEditRegion({ ...editRegion, is_active: checked })} />
            </div>
          ) : null}
          {editDistrict ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Input {...mt} label="Name" value={editDistrict.name} onChange={(e) => setEditDistrict({ ...editDistrict, name: e.target.value })} />
              <Input {...mt} label="Code" value={editDistrict.code} onChange={(e) => setEditDistrict({ ...editDistrict, code: e.target.value })} />
              <Select {...mt} label="Region" value={editDistrict.region_id ? String(editDistrict.region_id) : ''} onChange={(v) => setEditDistrict({ ...editDistrict, region_id: v ? Number(v) : null })}>
                <Option value="">— None —</Option>
                {regionOptions.map((r) => (
                  <Option key={r.id} value={String(r.id)}>{r.name}</Option>
                ))}
              </Select>
              <Input {...mt} label="iHRIS district ID" value={editDistrict.ihris_district_id ?? ''} onChange={(e) => setEditDistrict({ ...editDistrict, ihris_district_id: e.target.value })} />
              <Input {...mt} label="ISO code" value={editDistrict.iso_code} onChange={(e) => setEditDistrict({ ...editDistrict, iso_code: e.target.value })} />
              <Toggle label="Active" checked={editDistrict.is_active} onChange={(checked) => setEditDistrict({ ...editDistrict, is_active: checked })} />
            </div>
          ) : null}
          {editFacility ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Input {...mt} label="Name" value={editFacility.name} onChange={(e) => setEditFacility({ ...editFacility, name: e.target.value })} />
              <Select {...mt} label="District" value={editFacility.district_ref_id ? String(editFacility.district_ref_id) : ''} onChange={(v) => setEditFacility({ ...editFacility, district_ref_id: v ? Number(v) : null })}>
                <Option value="">— None —</Option>
                {districtOptions.map((d) => (
                  <Option key={d.id} value={String(d.id)}>{d.name}</Option>
                ))}
              </Select>
              <Select {...mt} label="Region" value={editFacility.region_id ? String(editFacility.region_id) : ''} onChange={(v) => setEditFacility({ ...editFacility, region_id: v ? Number(v) : null })}>
                <Option value="">— None —</Option>
                {regionOptions.map((r) => (
                  <Option key={r.id} value={String(r.id)}>{r.name}</Option>
                ))}
              </Select>
              <Input {...mt} label="Latitude" value={editFacility.latitude != null ? String(editFacility.latitude) : ''} onChange={(e) => setEditFacility({ ...editFacility, latitude: e.target.value ? Number(e.target.value) : null })} />
              <Input {...mt} label="Longitude" value={editFacility.longitude != null ? String(editFacility.longitude) : ''} onChange={(e) => setEditFacility({ ...editFacility, longitude: e.target.value ? Number(e.target.value) : null })} />
              <Toggle label="Active" checked={editFacility.is_active} onChange={(checked) => setEditFacility({ ...editFacility, is_active: checked })} />
            </div>
          ) : null}
          {editDepartment ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Input {...mt} label="Name" value={editDepartment.name} onChange={(e) => setEditDepartment({ ...editDepartment, name: e.target.value })} />
              <Input {...mt} label="External system ID" value={editDepartment.external_system_id} onChange={(e) => setEditDepartment({ ...editDepartment, external_system_id: e.target.value })} />
            </div>
          ) : null}
          {editJobTitle ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Input {...mt} label="Job title" value={editJobTitle.job_title} onChange={(e) => setEditJobTitle({ ...editJobTitle, job_title: e.target.value })} />
              <Input {...mt} label="External job ID" value={editJobTitle.external_job_id} onChange={(e) => setEditJobTitle({ ...editJobTitle, external_job_id: e.target.value })} />
            </div>
          ) : null}
          {editError ? <p className="mt-4 text-sm text-red-600">{editError}</p> : null}
          <div className="mt-6 flex gap-3">
            <Button {...mt} size="sm" className="rounded-sm bg-moh-green" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              Save changes
            </Button>
            <Button {...mt} size="sm" variant="outlined" onClick={closeEdit}>Cancel</Button>
          </div>
        </EditModal>
      )}

      {createOpen ? (
        <EditModal
          title={tab === 'departments' ? 'Add department' : 'Add job title'}
          onClose={() => setCreateOpen(false)}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              {...mt}
              label={tab === 'departments' ? 'Department name' : 'Job title'}
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              {...mt}
              label="External ID (optional)"
              value={createForm.external_id}
              onChange={(e) => setCreateForm((f) => ({ ...f, external_id: e.target.value }))}
            />
          </div>
          {editError ? <p className="mt-4 text-sm text-red-600">{editError}</p> : null}
          <div className="mt-6 flex gap-3">
            <Button
              {...mt}
              size="sm"
              className="rounded-sm bg-moh-green"
              loading={createMutation.isPending}
              disabled={!createForm.name.trim()}
              onClick={() => createMutation.mutate()}
            >
              Create
            </Button>
            <Button {...mt} size="sm" variant="outlined" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
          </div>
        </EditModal>
      ) : null}
    </div>
  )
}

function EditModal({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} role="presentation">
      <Card
        {...mt}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-sm border border-moh-green/20 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Typography {...mt} className="text-lg font-bold text-moh-green">
          {title}
        </Typography>
        <div className="mt-6">{children}</div>
      </Card>
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-sm border border-gray-100 bg-gray-50/80 px-4 py-3 md:col-span-2">
      <span className="text-sm font-medium">{label}</span>
      <Switch {...mt} checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  )
}

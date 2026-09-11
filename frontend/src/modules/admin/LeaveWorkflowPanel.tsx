import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Chip, Input, Switch, Typography } from '@material-tailwind/react'
import { Select, Option } from '@/components/molecules/MtSelect'
import { SearchableSelect } from '@/components/molecules/SearchableSelect'
import { GitBranch, Plus, Trash2 } from 'lucide-react'
import {
  leaveAdminService,
  type LeaveApprovalStage,
  type LeaveWorkflowProfile,
} from '@/api/services/leaveAdmin'
import { listsAdminService } from '@/api/services/listsAdmin'
import { QueryState } from '@/components/organisms/QueryState'
import { notifyApiError, toast } from '@/features/toast'
import { mt } from '@/utils/mt'
import { useAuthStore } from '@/stores/appStore'

const STAGE_TYPES = [
  { value: 'employee', label: 'Employee (no approval row)' },
  { value: 'supervisor', label: 'Supervisor chain' },
  { value: 'job_holder', label: 'Job holder (dynamic)' },
  { value: 'hr_finalize', label: 'HR records / finalize' },
]

const SCOPES = [
  { value: 'none', label: 'None' },
  { value: 'facility', label: 'Employee facility' },
  { value: 'district', label: 'Employee district' },
  { value: 'ministry', label: 'Ministry-wide' },
]

const STAGE_TYPE_LABELS: Record<string, string> = {
  employee: 'Employee submission',
  supervisor: 'Supervisor',
  job_holder: 'Job holder',
  hr_finalize: 'HR finalize',
}

const SCOPE_LABELS: Record<string, string> = {
  none: 'No scope limit',
  facility: 'Employee facility',
  district: 'Employee district',
  ministry: 'Ministry-wide',
}

const EMPTY_STAGE: Partial<LeaveApprovalStage> = {
  code: '',
  name: '',
  sequence: 1,
  approver_role: 'supervisor',
  stage_type: 'supervisor',
  scope: 'none',
  is_active: true,
  is_required: true,
  skip_if_unresolved: true,
}

function stageTypeLabel(type?: string) {
  return STAGE_TYPE_LABELS[type ?? ''] ?? type ?? 'Stage'
}

function ordinal(n: number) {
  const rem10 = n % 10
  const rem100 = n % 100
  if (rem10 === 1 && rem100 !== 11) return `${n}st`
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`
  return `${n}th`
}

function stageSecondaryLine(stage: LeaveApprovalStage): string {
  const type = stage.stage_type ?? 'supervisor'
  if (type === 'employee') return 'Submission step (no approval row created)'
  if (type === 'hr_finalize') return 'HR records / finalize'
  if (type === 'supervisor') {
    const n = stage.supervisor_sequence ?? 1
    return `${ordinal(n)} supervisor in chain`
  }
  const job =
    stage.job_title_match?.trim() ||
    (stage.job_title_id ? `Job #${stage.job_title_id}` : 'No job title selected')
  const scope = SCOPE_LABELS[stage.scope ?? 'none'] ?? stage.scope
  return `Job: ${job} · ${scope}`
}

export function LeaveWorkflowPanel() {
  const canManageWorkflow = useAuthStore((s) => s.hasPermission('leave.workflow.manage'))
  const queryClient = useQueryClient()
  const [profileCode, setProfileCode] = useState('default')
  const [editing, setEditing] = useState<Partial<LeaveApprovalStage> | null>(null)

  const profilesQuery = useQuery({
    queryKey: ['admin', 'leave', 'workflow-profiles'],
    queryFn: () => leaveAdminService.listWorkflowProfiles(),
  })

  const stagesQuery = useQuery({
    queryKey: ['admin', 'leave', 'workflow-stages', profileCode],
    queryFn: () => leaveAdminService.listWorkflowStages(profileCode),
  })

  const editingType = editing?.stage_type ?? 'supervisor'
  const jobsQuery = useQuery({
    queryKey: ['admin', 'lists', 'job-titles', 'workflow'],
    queryFn: async () => {
      const page = await listsAdminService.listJobTitles({ per_page: 200 })
      return page.data ?? []
    },
    enabled: Boolean(editing && editingType === 'job_holder'),
  })

  const profiles = profilesQuery.data ?? []
  const stages = useMemo(
    () => [...(stagesQuery.data ?? [])].sort((a, b) => a.sequence - b.sequence),
    [stagesQuery.data],
  )

  const jobOptions = useMemo(
    () =>
      (jobsQuery.data ?? []).map((j) => ({
        value: String(j.id),
        label: j.job_title,
        description: j.external_job_id || undefined,
      })),
    [jobsQuery.data],
  )

  // Legacy stages may only have job_title_match text — link to a system job when possible.
  useEffect(() => {
    if (!editing || editingType !== 'job_holder') return
    if (editing.job_title_id) return
    const needle = editing.job_title_match?.trim().toLowerCase()
    if (!needle || !jobsQuery.data?.length) return
    const match =
      jobsQuery.data.find((j) => j.job_title.toLowerCase() === needle) ??
      jobsQuery.data.find((j) => j.job_title.toLowerCase().includes(needle))
    if (!match) return
    setEditing((prev) => {
      if (!prev || prev.job_title_id) return prev
      return { ...prev, job_title_id: match.id, job_title_match: match.job_title }
    })
  }, [editingType, editing?.job_title_id, editing?.job_title_match, jobsQuery.data])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'leave', 'workflow-stages'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'leave', 'approval-stages'] })
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return
      const payload = { ...editing, workflow_profile_code: profileCode }
      if (editing.id) {
        await leaveAdminService.updateApprovalStage(editing.id, payload)
      } else {
        await leaveAdminService.createApprovalStage(payload)
      }
    },
    onSuccess: () => {
      setEditing(null)
      invalidate()
      toast.success('Workflow stage saved.', 'Saved')
    },
    onError: (error) => notifyApiError(error, 'Could not save workflow stage'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => leaveAdminService.deleteApprovalStage(id),
    onSuccess: () => {
      invalidate()
      toast.success('Stage removed.', 'Deleted')
    },
    onError: (error) => notifyApiError(error, 'Could not delete stage'),
  })

  const activeProfile = profiles.find((p) => p.code === profileCode)

  if (!canManageWorkflow) {
    return (
      <Card {...mt} className="rounded-sm border border-ui-border p-5">
        <Typography {...mt} className="text-sm text-gray-600">
          You do not have permission to manage leave approval workflows. Ask an administrator to grant{' '}
          <span className="font-mono text-xs">leave.workflow.manage</span>.
        </Typography>
      </Card>
    )
  }

  return (
    <Card {...mt} className="rounded-sm border border-ui-border p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-moh-green" />
          <Typography {...mt} className="text-sm font-bold uppercase text-moh-green">
            Approval workflows
          </Typography>
        </div>
        <Button
          {...mt}
          size="sm"
          className="flex items-center gap-1 rounded-sm bg-moh-green normal-case"
          onClick={() => setEditing({ ...EMPTY_STAGE, sequence: stages.length + 1 })}
        >
          <Plus className="h-4 w-4" />
          Add stage
        </Button>
      </div>

      <p className="mb-4 text-sm text-gray-600">
        Choose a profile, then review the numbered approval path below. Job-holder steps (HR, Permanent
        Secretary, etc.) resolve people by system job title and scope.
      </p>

      <div className="mb-5 max-w-md">
        <Select
          {...mt}
          label="Workflow profile"
          value={profileCode}
          onChange={(v) => setProfileCode((v as string) ?? 'default')}
        >
          {profiles.map((profile: LeaveWorkflowProfile) => (
            <Option key={profile.code} value={profile.code}>
              {profile.name}
              {profile.is_default ? ' (default)' : ''}
            </Option>
          ))}
        </Select>
        {activeProfile?.description ? (
          <p className="mt-2 text-xs text-gray-500">{activeProfile.description}</p>
        ) : null}
      </div>

      <QueryState
        isLoading={stagesQuery.isLoading}
        isError={stagesQuery.isError}
        error={stagesQuery.error}
        label="workflow stages"
        variant="table"
        onRetry={() => stagesQuery.refetch()}
      >
        <div className="relative space-y-0">
          {stages.map((stage, index) => (
            <div key={stage.id} className="relative flex gap-3 pb-4 last:pb-0">
              {index < stages.length - 1 ? (
                <div className="absolute bottom-0 left-3 top-8 w-px bg-moh-green/25" aria-hidden />
              ) : null}
              <span
                className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  stage.is_active ? 'bg-moh-green text-white' : 'bg-gray-300 text-gray-700'
                }`}
              >
                {stage.sequence}
              </span>
              <div
                className={`min-w-0 flex-1 rounded-sm border p-3 ${
                  stage.is_active ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-80'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {stage.name || 'Untitled stage'}
                      </span>
                      <Chip
                        {...mt}
                        size="sm"
                        value={stageTypeLabel(stage.stage_type)}
                        className="rounded-sm"
                      />
                      {!stage.is_active ? (
                        <Chip {...mt} size="sm" value="Inactive" color="gray" className="rounded-sm" />
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-gray-600">{stageSecondaryLine(stage)}</p>
                    <p className="mt-0.5 text-xs text-gray-400">Code: {stage.code || '—'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button {...mt} size="sm" variant="text" onClick={() => setEditing({ ...stage })}>
                      Edit
                    </Button>
                    {stage.stage_type !== 'employee' ? (
                      <Button
                        {...mt}
                        size="sm"
                        variant="text"
                        color="red"
                        className="flex items-center gap-1"
                        onClick={() => {
                          if (!window.confirm(`Remove stage “${stage.name || stage.code}”?`)) return
                          deleteMutation.mutate(stage.id)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {stages.length === 0 ? (
            <p className="text-sm text-gray-500">No stages in this profile yet. Add a stage to begin.</p>
          ) : null}
        </div>
      </QueryState>

      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditing(null)}
          role="presentation"
        >
          <Card
            {...mt}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-sm border border-moh-green/20 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Typography {...mt} className="text-lg font-bold text-moh-green">
              {editing.id ? 'Edit workflow stage' : 'Add workflow stage'}
            </Typography>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Input
                {...mt}
                label="Code"
                value={editing.code ?? ''}
                onChange={(e) => setEditing({ ...editing, code: e.target.value })}
              />
              <Input
                {...mt}
                label="Name"
                value={editing.name ?? ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
              <Input
                {...mt}
                label="Sequence"
                type="number"
                value={String(editing.sequence ?? 1)}
                onChange={(e) =>
                  setEditing({ ...editing, sequence: Number(e.target.value) || 1 })
                }
              />
              <Select
                {...mt}
                label="Stage type"
                value={editing.stage_type ?? 'supervisor'}
                onChange={(v) =>
                  setEditing({
                    ...editing,
                    stage_type: v as string,
                    approver_role:
                      v === 'hr_finalize'
                        ? 'hr_manager'
                        : v === 'employee'
                          ? 'health_worker'
                          : v === 'job_holder'
                            ? editing.approver_role || 'hr_manager'
                            : 'supervisor',
                  })
                }
              >
                {STAGE_TYPES.map((opt) => (
                  <Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Option>
                ))}
              </Select>

              {editingType === 'supervisor' ? (
                <Input
                  {...mt}
                  label="Supervisor sequence (1-3)"
                  type="number"
                  value={String(editing.supervisor_sequence ?? 1)}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      supervisor_sequence: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              ) : null}

              {editingType === 'job_holder' ? (
                <>
                  <Select
                    {...mt}
                    label="Scope"
                    value={editing.scope ?? 'none'}
                    onChange={(v) => setEditing({ ...editing, scope: v as string })}
                  >
                    {SCOPES.map((opt) => (
                      <Option key={opt.value} value={opt.value}>
                        {opt.label}
                      </Option>
                    ))}
                  </Select>
                  <div className="md:col-span-2">
                    <SearchableSelect
                      label="Job title"
                      value={editing.job_title_id ? String(editing.job_title_id) : ''}
                      options={jobOptions}
                      placeholder={jobsQuery.isLoading ? 'Loading job titles…' : 'Search job titles…'}
                      emptyLabel="Select a system job title"
                      onChange={(value) => {
                        const job = (jobsQuery.data ?? []).find((j) => String(j.id) === value)
                        setEditing({
                          ...editing,
                          job_title_id: value ? Number(value) : null,
                          job_title_match: job?.job_title ?? null,
                        })
                      }}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Approvers are staff whose current contract job matches this title within the selected
                      scope.
                    </p>
                  </div>
                </>
              ) : null}

              <Input
                {...mt}
                label="Approver role label"
                value={editing.approver_role ?? ''}
                onChange={(e) => setEditing({ ...editing, approver_role: e.target.value })}
              />

              <div className="flex items-center justify-between rounded-sm border border-gray-100 px-3 py-2 md:col-span-2">
                <div>
                  <span className="text-sm">Active</span>
                  <p className="text-xs text-gray-500">Inactive stages are skipped when building approvals.</p>
                </div>
                <Switch
                  {...mt}
                  checked={editing.is_active ?? true}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                />
              </div>
              <div className="flex items-center justify-between rounded-sm border border-gray-100 px-3 py-2 md:col-span-2">
                <div>
                  <span className="text-sm">Skip if no approver found at scope</span>
                  <p className="text-xs text-gray-500">
                    If no matching person is found at this scope, continue to the next stage.
                  </p>
                </div>
                <Switch
                  {...mt}
                  checked={editing.skip_if_unresolved ?? true}
                  onChange={(e) => setEditing({ ...editing, skip_if_unresolved: e.target.checked })}
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button
                {...mt}
                size="sm"
                className="rounded-sm bg-moh-green"
                loading={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                Save stage
              </Button>
              <Button {...mt} size="sm" variant="outlined" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </Card>
  )
}

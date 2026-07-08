import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Chip, Input, Switch, Typography } from '@material-tailwind/react'
import { Select, Option } from '@/components/molecules/MtSelect'
import { GitBranch, Plus, Trash2 } from 'lucide-react'
import {
  leaveAdminService,
  type LeaveApprovalStage,
  type LeaveWorkflowProfile,
} from '@/api/services/leaveAdmin'
import { QueryState } from '@/components/organisms/QueryState'
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

  const profiles = profilesQuery.data ?? []
  const stages = useMemo(
    () => [...(stagesQuery.data ?? [])].sort((a, b) => a.sequence - b.sequence),
    [stagesQuery.data],
  )

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
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => leaveAdminService.deleteApprovalStage(id),
    onSuccess: invalidate,
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
        Configure dynamic approval chains per workflow profile. Standard staff: Supervisor 1 → facility HR →
        HR records. Ministry/director profiles can add ministry HR and Permanent Secretary steps. Disable a
        stage or mark it skippable when no approver is found at that scope.
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
        <div className="space-y-3">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-sm border border-gray-100 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-moh-green/10 text-xs font-bold text-moh-green">
                    {stage.sequence}
                  </span>
                  <span className="font-medium">{stage.name}</span>
                  <Chip {...mt} size="sm" value={stage.stage_type ?? 'supervisor'} className="rounded-sm capitalize" />
                  {!stage.is_active ? (
                    <Chip {...mt} size="sm" value="Off" color="gray" className="rounded-sm" />
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Code: {stage.code}
                  {stage.scope && stage.scope !== 'none' ? ` · Scope: ${stage.scope}` : ''}
                  {stage.job_title_match ? ` · Job match: “${stage.job_title_match}”` : ''}
                  {stage.supervisor_sequence ? ` · Supervisor ${stage.supervisor_sequence}` : ''}
                </p>
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
                    onClick={() => deleteMutation.mutate(stage.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </QueryState>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)} role="presentation">
          <Card
            {...mt}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-sm border border-moh-green/20 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Typography {...mt} className="text-lg font-bold text-moh-green">
              {editing.id ? 'Edit workflow stage' : 'Add workflow stage'}
            </Typography>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Input {...mt} label="Code" value={editing.code ?? ''} onChange={(e) => setEditing({ ...editing, code: e.target.value })} />
              <Input {...mt} label="Name" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <Input {...mt} label="Sequence" type="number" value={String(editing.sequence ?? 1)} onChange={(e) => setEditing({ ...editing, sequence: Number(e.target.value) || 1 })} />
              <Select {...mt} label="Stage type" value={editing.stage_type ?? 'supervisor'} onChange={(v) => setEditing({ ...editing, stage_type: v as string })}>
                {STAGE_TYPES.map((opt) => (
                  <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                ))}
              </Select>
              <Select {...mt} label="Scope" value={editing.scope ?? 'none'} onChange={(v) => setEditing({ ...editing, scope: v as string })}>
                {SCOPES.map((opt) => (
                  <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                ))}
              </Select>
              <Input {...mt} label="Job title match" value={editing.job_title_match ?? ''} onChange={(e) => setEditing({ ...editing, job_title_match: e.target.value })} />
              <Input {...mt} label="Supervisor sequence (1-3)" type="number" value={String(editing.supervisor_sequence ?? '')} onChange={(e) => setEditing({ ...editing, supervisor_sequence: e.target.value ? Number(e.target.value) : null })} />
              <Input {...mt} label="Approver role label" value={editing.approver_role ?? ''} onChange={(e) => setEditing({ ...editing, approver_role: e.target.value })} />
              <div className="flex items-center justify-between rounded-sm border border-gray-100 px-3 py-2 md:col-span-2">
                <span className="text-sm">Active</span>
                <Switch {...mt} checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
              </div>
              <div className="flex items-center justify-between rounded-sm border border-gray-100 px-3 py-2 md:col-span-2">
                <span className="text-sm">Skip if no approver found at scope</span>
                <Switch {...mt} checked={editing.skip_if_unresolved ?? true} onChange={(e) => setEditing({ ...editing, skip_if_unresolved: e.target.checked })} />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button {...mt} size="sm" className="rounded-sm bg-moh-green" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                Save stage
              </Button>
              <Button {...mt} size="sm" variant="outlined" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </Card>
  )
}

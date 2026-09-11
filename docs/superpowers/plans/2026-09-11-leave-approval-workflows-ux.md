# Leave Approval Workflows UX Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix blank/identical approval workflow stages and make the list + job-title editing clear for admins.

**Architecture:** Add snake_case JSON tags on `LeaveApprovalStage` so the UI receives real fields. Redesign `LeaveWorkflowPanel` as a numbered path with type-aware labels, and replace free-text job match with `SearchableSelect` over system job titles (`listsAdminService.listJobTitles`), storing both `job_title_id` and `job_title_match`.

**Tech Stack:** Goravel/Go models, React + TanStack Query, Material Tailwind, existing `SearchableSelect`, `@/features/toast`.

**Spec:** `docs/superpowers/specs/2026-09-11-leave-approval-workflows-ux-design.md`

## Global Constraints

- Do not invent new workflow profile CRUD endpoints (profiles stay seed-managed).
- Do not move leave-type ↔ profile assignment in this plan.
- Match existing admin Configuration card patterns (`rounded-sm border border-ui-border`, moh-green headings).
- Prefer host/runtime behavior already in `leave_workflow_service.go` (`JobTitleID` exact + `JobTitleMatch` substring).
- Do not commit unless the user explicitly asks for a commit.

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/app/models/pms.go` | Snake_case `json` tags on `LeaveApprovalStage` |
| `frontend/src/modules/admin/LeaveWorkflowPanel.tsx` | Clear stage path UI + conditional edit modal + job select |
| `frontend/src/api/services/leaveAdmin.ts` | Types already OK; only touch if payload helpers needed |
| `frontend/src/api/services/listsAdmin.ts` | Reuse `listJobTitles` (no change unless fetch helper needed) |

---

### Task 1: Fix LeaveApprovalStage JSON serialization

**Files:**
- Modify: `backend/app/models/pms.go` (`LeaveApprovalStage` struct)

**Interfaces:**
- Consumes: existing GORM columns
- Produces: JSON keys matching frontend `LeaveApprovalStage` in `leaveAdmin.ts`

- [ ] **Step 1: Update struct tags**

Replace the `LeaveApprovalStage` field definitions (keep gorm tags; add json) so the type looks like:

```go
type LeaveApprovalStage struct {
	orm.Model
	Code                string  `json:"code" gorm:"uniqueIndex:idx_leave_stage_profile_code"`
	Name                string  `json:"name"`
	Sequence            uint8   `json:"sequence"`
	ApproverRole        string  `json:"approver_role"`
	Description         *string `json:"description,omitempty"`
	IsActive            bool    `json:"is_active" gorm:"default:true"`
	WorkflowProfileCode string  `json:"workflow_profile_code" gorm:"column:workflow_profile_code;default:default;uniqueIndex:idx_leave_stage_profile_code"`
	StageType           string  `json:"stage_type" gorm:"column:stage_type;default:supervisor"`
	Scope               string  `json:"scope" gorm:"default:none"`
	JobTitleID          *uint   `json:"job_title_id,omitempty" gorm:"column:job_title_id"`
	JobTitleMatch       *string `json:"job_title_match,omitempty" gorm:"column:job_title_match"`
	SupervisorSequence  *uint8  `json:"supervisor_sequence,omitempty" gorm:"column:supervisor_sequence"`
	IsRequired          bool    `json:"is_required" gorm:"default:true"`
	SkipIfUnresolved    bool    `json:"skip_if_unresolved" gorm:"column:skip_if_unresolved;default:true"`
}
```

Confirm `LeaveWorkflowProfile` already has snake_case tags (do not regress them).

- [ ] **Step 2: Verify compile**

Run:

```bash
cd backend && go build -o /dev/null .
```

Expected: exit 0.

- [ ] **Step 3: Manual API spot-check (when stack is up)**

```bash
# Authenticated call or docker exec into API after login cookie/token
# Expect keys: "name", "code", "sequence", "is_active", "stage_type"
curl -sS "http://127.0.0.1:8081/api/v1/admin/leave/workflow-stages?profile=default" \
  -H "Authorization: Bearer <token>" | head -c 800
```

Expected: JSON uses snake_case keys with non-empty `name` / `code` for seeded stages.

---

### Task 2: Clear numbered stage path list

**Files:**
- Modify: `frontend/src/modules/admin/LeaveWorkflowPanel.tsx`

**Interfaces:**
- Consumes: `LeaveApprovalStage` with snake_case fields from Task 1
- Produces: readable stage list helpers used by Task 3 modal

- [ ] **Step 1: Add display helpers at top of `LeaveWorkflowPanel.tsx`**

```tsx
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

function stageTypeLabel(type?: string) {
  return STAGE_TYPE_LABELS[type ?? ''] ?? type ?? 'Stage'
}

function stageSecondaryLine(stage: LeaveApprovalStage): string {
  const type = stage.stage_type ?? 'supervisor'
  if (type === 'employee') return 'Submission step (no approval row created)'
  if (type === 'hr_finalize') return 'HR records / finalize'
  if (type === 'supervisor') {
    const n = stage.supervisor_sequence ?? 1
    return `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'} supervisor in chain`
  }
  // job_holder
  const job = stage.job_title_match?.trim() || (stage.job_title_id ? `Job #${stage.job_title_id}` : 'No job title selected')
  const scope = SCOPE_LABELS[stage.scope ?? 'none'] ?? stage.scope
  return `Job: ${job} · ${scope}`
}
```

- [ ] **Step 2: Replace the stages map UI**

Render each stage as a numbered row with connector (except last):

```tsx
<div className="relative space-y-0">
  {stages.map((stage, index) => (
    <div key={stage.id} className="relative flex gap-3 pb-4 last:pb-0">
      {index < stages.length - 1 ? (
        <div className="absolute left-3 top-8 bottom-0 w-px bg-moh-green/25" aria-hidden />
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
              <span className="font-medium text-gray-900">{stage.name || 'Untitled stage'}</span>
              <Chip {...mt} size="sm" value={stageTypeLabel(stage.stage_type)} className="rounded-sm" />
              {!stage.is_active ? (
                <Chip {...mt} size="sm" value="Inactive" color="gray" className="rounded-sm" />
              ) : null}
            </div>
            <p className="mt-1 text-xs text-gray-600">{stageSecondaryLine(stage)}</p>
            <p className="mt-0.5 text-xs text-gray-400">Code: {stage.code || '—'}</p>
          </div>
          {/* Edit / Delete buttons unchanged except delete confirm in Task 3 */}
        </div>
      </div>
    </div>
  ))}
</div>
```

Keep the profile `Select` and short helper paragraph; trim the long jargon paragraph to 1–2 sentences pointing at the numbered path.

- [ ] **Step 3: Visual check**

Open `/admin/leave` → Configuration → Approval workflows.  
Expected: Standard staff shows distinct names (Employee submission, First supervisor, Facility HR Manager, HR records) with numbers 1–4 and not all “Supervisor/Off”.

---

### Task 3: Conditional edit modal + job title SearchableSelect + toasts

**Files:**
- Modify: `frontend/src/modules/admin/LeaveWorkflowPanel.tsx`
- Reuse: `frontend/src/components/molecules/SearchableSelect.tsx`
- Reuse: `frontend/src/api/services/listsAdmin.ts` (`listJobTitles`)
- Reuse: `frontend/src/features/toast` (`toast`, `notifyApiError`)

**Interfaces:**
- Consumes: `listsAdminService.listJobTitles({ per_page: 200 })` → `JobTitleListRow[]`
- Produces: save payload with `job_title_id` + `job_title_match` for `job_holder` stages

- [ ] **Step 1: Load job titles when editing a job_holder stage**

```tsx
import { SearchableSelect } from '@/components/molecules/SearchableSelect'
import { listsAdminService } from '@/api/services/listsAdmin'
import { notifyApiError, toast } from '@/features/toast'

const jobsQuery = useQuery({
  queryKey: ['admin', 'lists', 'job-titles', 'workflow'],
  queryFn: async () => {
    const page = await listsAdminService.listJobTitles({ per_page: 200 })
    return page.data ?? []
  },
  enabled: Boolean(editing && (editing.stage_type ?? '') === 'job_holder'),
})

const jobOptions = useMemo(
  () =>
    (jobsQuery.data ?? []).map((j) => ({
      value: String(j.id),
      label: j.job_title,
      description: j.external_job_id || undefined,
    })),
  [jobsQuery.data],
)
```

- [ ] **Step 2: Conditional fields in the modal**

Show:
- Always: Code, Name, Sequence, Stage type, Active, Skip-if-unresolved (with helper: “If no matching person is found at this scope, continue to the next stage.”)
- If `stage_type === 'supervisor'`: Supervisor sequence (1–3); hide job select and scope (or force scope `none`)
- If `stage_type === 'job_holder'`: Scope + `SearchableSelect` labeled “Job title”; hide supervisor sequence
- If `employee` or `hr_finalize`: hide job select, supervisor sequence; scope optional/hidden (default `none`)

On job select:

```tsx
onChange={(value) => {
  const job = (jobsQuery.data ?? []).find((j) => String(j.id) === value)
  setEditing({
    ...editing,
    job_title_id: value ? Number(value) : null,
    job_title_match: job?.job_title ?? null,
  })
}}
```

When opening edit for a stage that only has `job_title_match`, if options load and a title matches case-insensitively, set `job_title_id` in local edit state (optional UX nicety).

- [ ] **Step 3: Wire save/delete feedback**

```tsx
const saveMutation = useMutation({
  mutationFn: async () => { /* existing */ },
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
```

Delete button:

```tsx
onClick={() => {
  if (!window.confirm(`Remove stage “${stage.name}”?`)) return
  deleteMutation.mutate(stage.id)
}}
```

- [ ] **Step 4: Manual verification**

1. Edit “Facility HR Manager”: job title select lists system jobs; pick one; save; list secondary line shows that job name.  
2. Edit supervisor stage: no job select; supervisor sequence visible.  
3. Switch to Ministry / director: Permanent Secretary / Ministry HR show names, not blank Supervisor/Off.  
4. Delete confirm appears; employee stage has no delete.

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Snake_case JSON on stages | Task 1 |
| Numbered vertical path + human labels | Task 2 |
| Job holder shows job title on list | Task 2 + 3 |
| Searchable job select (not free text) | Task 3 |
| Conditional fields by stage type | Task 3 |
| Confirm delete + toast | Task 3 |
| No profile CRUD / no leave-type move | Out of scope (honored) |

## Placeholder / consistency review

- No TBD steps; helpers and UI fragments are concrete.
- Types align with existing `LeaveApprovalStage` and `JobTitleListRow`.
- Save continues to set `workflow_profile_code: profileCode` from selected profile.

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-11-leave-approval-workflows-ux.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement in this session with checkpoints  

Which approach?

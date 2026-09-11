# Leave Approval Workflows UX Clarity

**Date:** 2026-09-11  
**Status:** Approved for implementation (Approach A)  
**Scope:** Admin leave Configuration → Approval workflows (`/admin/leave`)

## Problem

Admins cannot understand or manage leave approval workflows:

1. Stage list rows look identical (“Supervisor” / “Off”) with blank names and codes.
2. Non-dynamic stages (e.g. Facility HR, Permanent Secretary, HR records) do not show clear human-readable names or job titles.
3. “Job title match” is free text instead of selecting a system job title.
4. Step order is hard to read in the list below the profile summary.

Root cause of blank rows: `LeaveApprovalStage` (and related profile fields) lack snake_case `json` tags, so the API returns Go export names while the frontend reads `name`, `code`, `is_active`, etc.

## Goals

- Stages display correctly with names, sequence, and active state.
- List reads as a clear ordered approval path.
- Job-holder stages use a searchable select of system job titles.
- Preserve existing backend runtime resolution (`job_title_id` and/or `job_title_match`).

## Non-goals

- Creating/editing workflow profiles in the UI (profiles remain seed-managed).
- A guided wizard (Approach B) or locking presets only (Approach C).
- Changing leave-type ↔ profile assignment location in this iteration (optional follow-up).

## Design

### 1. API JSON binding

Add snake_case `json` tags on `LeaveApprovalStage` fields used by the admin UI, including at least:

- `code`, `name`, `sequence`, `approver_role`, `description`, `is_active`
- `workflow_profile_code`, `stage_type`, `scope`
- `job_title_id`, `job_title_match`, `supervisor_sequence`
- `is_required`, `skip_if_unresolved`
- standard model `id` / timestamps as already used elsewhere

Add tags on `LeaveWorkflowProfile` if any profile list fields are similarly broken.

No new endpoints required. Stage create/update already accept these fields via `leave_config_service`.

### 2. Clearer stage list (`LeaveWorkflowPanel`)

Replace flat identical chips with a numbered vertical path:

- Primary: sequence number + **stage name**
- Type chip with plain labels (Employee / Supervisor / Job holder / HR finalize)
- Active vs inactive: muted styling + clear badge (only when inactive)
- Secondary line by type:
  - Supervisor: “Nth supervisor”
  - Job holder: job title name (from `job_title_id` lookup or `job_title_match`) + scope label
  - HR finalize: “HR records / finalize”
  - Employee: “Submission (no approval row)”
- Visual connector between steps so order is obvious
- Keep Edit / Delete (no delete for `employee` stages); confirm before delete

### 3. Edit modal

- Conditionally show fields by `stage_type`:
  - Supervisor → supervisor sequence (1–3)
  - Job holder → searchable job title select (system jobs via existing lists API)
  - Employee / HR finalize → hide job match and supervisor sequence
- Job holder save: set `job_title_id` from selection; set `job_title_match` to the selected job’s `job_title` string for display/fallback (runtime already supports both)
- Scope select remains for job-holder stages
- Active + Skip-if-unresolved toggles with short helper text
- Toast on save success/error

### 4. Job title data

- Load options from existing admin lists: `GET /admin/lists/job-titles` (or KPI jobs list if already used nearby), via `SearchableSelect` pattern used elsewhere in admin.
- If a stage only has legacy `job_title_match` text and no `job_title_id`, show that text in the list and pre-fill select by matching title when possible.

## Files (expected)

| Area | Path |
|------|------|
| Model JSON | `backend/app/models/pms.go` |
| Panel UI | `frontend/src/modules/admin/LeaveWorkflowPanel.tsx` |
| Types (if needed) | `frontend/src/api/services/leaveAdmin.ts` |

## Testing

1. Open `/admin/leave` → Configuration → Approval workflows.
2. Switch profiles (`default`, `ministry_senior`): each stage shows distinct name, sequence, and not all “Off”.
3. Job-holder stages show job title / role wording on the list line.
4. Edit a job-holder stage: pick a job from searchable select; save; list updates.
5. Supervisor / HR finalize edit does not show irrelevant job match.
6. Delete still blocked for employee stages; other deletes ask for confirm.
7. Submit a leave request still builds approval plan (smoke check of runtime path).

## Success criteria

- Non-technical admins can tell which step is which without opening Edit.
- HR-style stages show a concrete job title name, not empty “Supervisor”.
- Job match is chosen from system jobs, not typed blindly.

# Leave Flow and Management — MoH Performance Management System

This document describes Uganda Ministry of Health leave policy context and how leave is implemented in PMS, including the **configurable approval workflow** introduced in 2026.

---

## 1. Leave types and entitlements

| Leave type | Entitlement | Eligibility | Key conditions |
|------------|-------------|-------------|----------------|
| **Annual leave** | U2+: 36 days; U7–U3: 30 days; U8: 24 days | Full-time public officers | Vests 1 January; taken within calendar year |
| **Sick leave** | 90 days full pay (extendable to 180) | All officers with medical recommendation | Medical officer report if absence > 2 working days |
| **Maternity leave** | 60 working days full pay | Female officers | Can start 36–38 weeks; extra days may offset earned leave |
| **Paternity leave** | 4 working days full pay | Male officers after wife's delivery/miscarriage | Immediate after birth or miscarriage |
| **Study leave** | Full salary during approved study | Officers identified for training | Uses **ministry_senior** workflow by default |
| **Special leave of absence** | Up to 10 days/year (discretionary) | All officers | Personal catastrophe, school holidays, sick family |
| **Sabbatical leave** | 12 months with pay (once per 10 years) | 10+ years continuous service | Evidence of benefit to service |
| **Leave without pay** | Up to 5 years (renewable once) | Officers joining international orgs/projects | Not leave-earning; increments deferred |

Entitlements by salary grade are configured in **Admin → Leave → Configuration → Annual entitlements by grade**.

---

## 2. Dynamic leave approval workflow

PMS no longer hard-codes “three supervisors then HR”. Instead, each **leave type** is linked to a **workflow profile**, and each profile defines an ordered list of **approval stages**.

### 2.1 Concepts

| Concept | Description |
|---------|-------------|
| **Workflow profile** | Named approval chain (e.g. `default`, `ministry_senior`). One profile is marked default for new leave types. |
| **Approval stage** | A step in the chain: sequence, type, scope, and how the approver is resolved. |
| **Leave type assignment** | Each leave type has `workflow_profile_code` — HR assigns this under **Admin → Leave → Configuration**. |

### 2.2 Stage types

| Stage type | Purpose | Creates approval row? |
|------------|---------|------------------------|
| `employee` | Employee submission (informational) | No |
| `supervisor` | Supervisor chain from iHRIS | Yes — uses `supervisor_sequence` (1 = first supervisor) |
| `job_holder` | Dynamic approver by job title at a scope | Yes — resolves staff holding matching job |
| `hr_finalize` | HR records / balance update | No row — HR finalises in admin when prior stages complete |

### 2.3 Scopes (for `job_holder` stages)

| Scope | Approver search area |
|-------|----------------------|
| `facility` | Employee's deployed facility |
| `district` | Employee's district (via facility district reference) |
| `ministry` | Ministry-wide (all active contracts) |
| `none` | Not used for job resolution |

Job holders are matched by **job title text** (`job_title_match`, case-insensitive contains) or optional `job_title_id`.

### 2.4 Skipping and disabling stages

| Flag | Behaviour |
|------|-----------|
| `is_active = false` | Stage is ignored when building the approval plan |
| `skip_if_unresolved = true` | If no approver is found at the configured scope, the stage is skipped (typical for optional facility HR when facility has no HR Manager) |
| `is_required = true` + `skip_if_unresolved = false` | Submission fails if approver cannot be resolved |

This allows facilities without HR to fall through to district or ministry stages when HR adds those steps to the profile.

---

## 3. Default workflow profiles (seeded)

### 3.1 `default` — Standard staff

| Seq | Code | Name | Type | Scope | Notes |
|-----|------|------|------|-------|-------|
| 1 | `employee` | Employee submission | employee | — | No approval row |
| 2 | `supervisor_1` | First supervisor | supervisor | — | `supervisor_sequence = 1` |
| 3 | `facility_hr` | Facility HR Manager | job_holder | facility | Match `"Human Resource"`; skippable if unresolved |
| 4 | `hr` | HR records | hr_finalize | — | HR finalises in admin |

**Typical flow:** Employee → First supervisor → Facility HR (if present) → HR records.

### 3.2 `ministry_senior` — Ministry / director roles

| Seq | Code | Name | Type | Scope | Notes |
|-----|------|------|------|-------|-------|
| 1 | `employee` | Employee submission | employee | — | |
| 2 | `supervisor_1` | First supervisor | supervisor | — | |
| 3 | `ministry_hr` | Ministry HR | job_holder | ministry | Match `"Human Resource"`; skippable |
| 4 | `permanent_secretary` | Permanent Secretary | job_holder | ministry | Match `"Permanent Secretary"`; skippable |
| 5 | `hr` | HR records | hr_finalize | — | |

**Typical flow:** Employee → First supervisor → Ministry HR → PS → HR records.

Study leave (`code = study`) is assigned this profile by default.

---

## 4. Runtime behaviour

```
Employee submits leave request
        │
        ▼
System loads workflow profile for leave type
        │
        ▼
For each active stage (by sequence):
  • employee / hr_finalize → metadata only
  • supervisor → resolve supervisor N from iHRIS
  • job_holder → find staff at scope with matching job title
  • skip stage if unresolved and skip_if_unresolved = true
        │
        ▼
Create leave_approvals rows (pending, with stage_name / stage_code)
        │
        ▼
Approvers act in sequence (approve / reject with comments)
        │
        ▼
When no pending approvals remain → status approved, awaiting HR finalize
        │
        ▼
HR Officer finalises → balances updated, status completed
```

### Special policy roles (manual configuration)

Public Service rules may require additional approvers (e.g. Responsible Officer, Appointing Authority, Service Commission for long-term study). Add these as extra `job_holder` or `supervisor` stages in a custom workflow profile and assign the leave type to that profile.

---

## 5. Configuring workflows (HR / Administrator)

**Path:** Admin → Leave → Configuration

### 5.1 Assign workflow to a leave type

Under **Leave types**, use the **Workflow** dropdown to set `workflow_profile_code` per leave type.

### 5.2 Edit approval stages

Under **Approval workflows**:

1. Select a **workflow profile**.
2. Review stages in sequence order.
3. **Add stage** or **Edit** to change:
   - Code, name, sequence
   - Stage type (`supervisor`, `job_holder`, `hr_finalize`)
   - Scope (`facility`, `district`, `ministry`)
   - Job title match text (e.g. `Human Resource`, `Permanent Secretary`)
   - Supervisor sequence (1–3)
   - Active / skip-if-unresolved toggles
4. **Delete** optional stages (employee submission cannot be deleted).

### 5.3 Example: facility without HR → district approver

Add a stage after `facility_hr`:

| Field | Value |
|-------|-------|
| Code | `district_hr` |
| Name | District HR Officer |
| Sequence | 4 (before `hr_finalize`) |
| Stage type | `job_holder` |
| Scope | `district` |
| Job title match | `Human Resource` |
| Skip if unresolved | true |

Ensure `facility_hr` also has **skip if unresolved** enabled so requests proceed when neither facility nor district HR is found (only if policy allows).

### 5.4 Turning levels off

- Set **Active** off on a stage to remove it from new requests.
- Existing in-flight requests keep their already-created approval rows.

---

## 6. Leave tracking and management

### 6.1 Leave rosters

- Rosters for the ensuing year should be available by 31 December.
- Copy exhibited on notice boards.
- Heads of unit ensure staff take leave when due.

### 6.2 Carry-over and forfeiture

| Rule | Description |
|------|-------------|
| General | Annual leave does not accumulate across calendar years without approval |
| Exception | Written carry-over request approved by 15 December |
| Accumulated leave | Officers cannot be forced to take accumulated leave without prior carry-over approval |

Configured in **Admin → Leave → Configuration → Policy settings** (`allow_carry_over`, `carry_over_deadline`).

### 6.3 Tracking in PMS

- Real-time balances, approval status, and history per staff.
- Supervisors see pending items with **stage name** (e.g. “First supervisor”, “Facility HR Manager”).
- HR sees requests **awaiting HR finalization** after workflow approvals complete.
- Attendance links to performance where configured.

---

## 7. Compliance requirements

| Requirement | Detail |
|-------------|--------|
| Work hours | 08:00–12:45; 14:00–17:00 (Mon–Fri) — configurable in leave policy settings |
| Advance notice | Default 14 days for annual leave — configurable |
| Attendance register | Signed daily 08:00–08:30; submitted monthly |
| Absenteeism | Unauthorised absence may lead to disciplinary action |
| Public holidays | Per Public Holidays Act; compensatory rest if working on holiday |

---

## 8. API reference (integrators)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/admin/leave/workflow-profiles` | List workflow profiles |
| GET | `/api/v1/admin/leave/workflow-stages?profile=default` | Stages for a profile |
| POST/PUT/DELETE | `/api/v1/admin/leave/approval-stages` | Manage stages |
| PUT | `/api/v1/admin/leave/types/{id}` | Set `workflow_profile_code` on leave type |
| GET | `/api/v1/mobile/leave/pending-approvals` | Approver inbox (includes `stage_name`) |
| POST | `/api/v1/admin/leave/requests/{id}/finalize` | HR finalize after workflow |

---

## 9. Database tables

| Table | Role |
|-------|------|
| `leave_workflow_profiles` | Profile definitions |
| `leave_approval_stages` | Stage configuration per profile |
| `leave_types.workflow_profile_code` | Profile assignment |
| `leave_approvals` | Runtime rows (`stage_code`, `stage_name`, `stage_type`) |
| `leave_requests.approval_stage` | Current stage code (e.g. `supervisor_1`, `hr`) |

---

*Last updated: July 2026 — dynamic workflow release*

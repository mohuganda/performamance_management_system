# Annual Leave Plan, Reminders, and OIC — Design Spec

**Date:** 2026-08-17  
**Status:** Approved (conversation); awaiting implementation plan  
**Product:** MoH Uganda Performance Management System (PMS)

## 1. Problem

Staff need to schedule intended annual leave for the year (policy: leave rosters by 31 December — see `leave.md` §6.1), without turning those plans into leave requests automatically. Employees and supervisors should be reminded before leave starts. When applying for leave, the employee must name an Officer-in-Charge (OIC) who covers while they are away.

## 2. Goals (v1)

1. **Plan only** — employees create/edit/delete planned annual-leave blocks for a calendar year; no auto-conversion to requests; no balance debit; no approval workflow on the plan.
2. **Reminders** — notify the employee and their primary supervisor before upcoming leave, from both planned blocks and approved leave requests, at 7 days and 1 day before start (configurable).
3. **OIC on leave application** — required staff picker on leave create; stored and shown through approval and HR views.

## 3. Non-goals (v1)

- Converting a plan block into a leave request in one click
- Submitting / approving a full-year plan as a package
- Public notice-board roster export
- Reminding for leave types other than annual on the plan (plans are annual-only); approved-request reminders cover any approved leave type that has a start date
- Changing leave balance debit rules (still only on HR finalize)

## 4. User experience

### 4.1 Navigation

Under **Out of Station & Leave** (`time-attendance`):

| Item | Path | Permission |
|------|------|------------|
| Leave plan (new) | `/leave-plan` | `leave.plans.view` (grant alongside existing leave view roles) |
| Leave | `/leave` | unchanged |
| Out of Station | `/out-of-station` | unchanged |

Also add a quick link on `LeavePage` (“Manage annual leave plan”) and optionally on Module Quick Links.

### 4.2 Leave plan page (`/leave-plan`)

- Year selector (default: current calendar year; allow next year for roster planning).
- List of planned blocks for the signed-in staff member: start, end, working days (reuse leave day-count rules), notes, actions.
- Form: start date, end date, optional notes. Validate end ≥ start; dates within selected year (or spanning years: split or reject — **v1: both dates must fall in the selected calendar year**).
- Soft warning if sum of planned working days for the year exceeds remaining annual entitlement (+ carried over) for that year; save still allowed.
- Overlap with another plan block for the same staff/year: **reject** with a clear error.
- No status field beyond existence (blocks are always “planned”). Soft-delete or hard-delete is fine; **v1: hard delete**.

**Supervisor / HR read view (v1 light):**

- If the user has `leave.plans.view_team` (or existing `leave.requests.approve` / leave admin), show a “Team plans” tab or filter: staff under their supervision (primary supervisor chain) or facility scope for HR — same scoping patterns as leave admin where practical.
- Team view is read-only in v1.

### 4.3 Leave application (OIC)

On `/leave` create form:

- Add **Officer in charge (OIC)** — required `SearchableSelect` of staff (reuse supervisor-candidates or staff search API).
- Exclude self from the OIC list.
- Persist `oic_staff_id` on the leave request.
- Show OIC name on: request list/detail, pending approvals, Approvals inbox row detail if shown, Leave Admin requests / statement.

### 4.4 Reminders (user-visible)

- In-app notification (+ email copy if existing in-app email-copy setting is on).
- Copy examples:
  - Employee: “Your annual leave plan starts on {date} (in {n} day(s)).”
  - Supervisor: “{Employee name} has leave starting on {date} (in {n} day(s)).”
- Distinguish plan vs approved request in title/body (`leave_plan_reminder` vs `leave_start_reminder`).
- Action URL: `/leave-plan` or `/leave` as appropriate.

## 5. Data model

### 5.1 `leave_plans`

| Column | Type | Notes |
|--------|------|--------|
| id | PK | |
| staff_id | FK staff | owner |
| calendar_year | int | denormalized for queries |
| start_date | date | |
| end_date | date | |
| days_planned | int | computed on save |
| notes | text nullable | |
| created_at / updated_at | | |

Indexes: `(staff_id, calendar_year)`, `(start_date)` for reminder scans.

No FK to `leave_requests` in v1.

### 5.2 `leave_requests` alteration

| Column | Type | Notes |
|--------|------|--------|
| oic_staff_id | uint nullable → required on new submits | existing rows may be null; new creates require OIC |

### 5.3 Reminder dedupe

Reuse `user_notifications.dedupe_key` pattern, e.g.:

- `leave_plan:{plan_id}:d{days_before}`
- `leave_request:{request_id}:d{days_before}`

Sent once per offset per entity.

### 5.4 Settings keys (`system_configs`, group `notifications`)

| Key | Default | Meaning |
|-----|---------|---------|
| `notifications.leave_plan_reminder.enabled` | true | Plan-based reminders |
| `notifications.leave_start_reminder.enabled` | true | Approved-request reminders |
| `notifications.leave_reminder.days_before` | `"7,1"` | Comma-separated day offsets |

Wire into Settings → Notifications UI alongside existing PPA / supervisor approval toggles.

## 6. Backend API

### 6.1 Self-service (auth; staff-linked user)

Prefix: `/api/v1/mobile/leave-plans` (or `/api/v1/leave-plans` — prefer **mobile** consistency with leave requests).

| Method | Path | Permission | Behaviour |
|--------|------|------------|-----------|
| GET | `/leave-plans?year=` | `leave.plans.view` | Own plans for year |
| POST | `/leave-plans` | `leave.plans.manage` | Create own plan block |
| PUT | `/leave-plans/{id}` | `leave.plans.manage` | Update own block |
| DELETE | `/leave-plans/{id}` | `leave.plans.manage` | Delete own block |
| GET | `/leave-plans/team?year=` | `leave.plans.view_team` | Team/facility plans (read-only) |

### 6.2 Leave create change

`POST /mobile/leave/requests` body adds required `oic_staff_id` (uint). Validate staff exists and ≠ applicant. Surface OIC in list/detail payloads (`oic_staff_id`, `oic_name`).

### 6.3 Reminder runner

Extend `NotificationService.SendAllReminders()` (and/or scheduled artisan if one exists) to:

1. Load enabled flags and day offsets.
2. For each offset `d`: find `leave_plans` where `start_date = today + d`.
3. For each offset `d`: find leave requests with `start_date = today + d` where leave is confirmed enough to remind: `status = approved` **or** `approval_stage = completed`. Do **not** remind on `draft`, `pending`, or `rejected`.
4. Resolve employee user + primary supervisor (`StaffSupervisor` sequence 1); create in-app notifications with dedupe; optional email.

Trigger remains `POST /admin/notifications/send-reminders` and any existing cron that calls it.

## 7. Permissions & RBAC

New permissions (seed + grant to roles that already have leave self-service / supervisor / HR):

| Code | Purpose |
|------|---------|
| `leave.plans.view` | See own leave plan page |
| `leave.plans.manage` | CRUD own plan blocks |
| `leave.plans.view_team` | View supervised / scoped team plans |

Grant:

- Health worker / standard staff roles: `view` + `manage`
- Supervisor roles: + `view_team`
- HR / leave admin: + `view_team`

Reuse existing leave view permission for nav if preferred, but **prefer dedicated codes** so planning can be gated independently later.

## 8. Frontend modules

| Area | Work |
|------|------|
| `navItems.ts` | New Leave plan item |
| `AppRoutes.tsx` | Route + permission gate |
| `modules/leave/LeavePlanPage.tsx` | New page (own + optional team tab) |
| `api/services/mobile.ts` or `leavePlan.ts` | API client |
| `LeavePage.tsx` | OIC field + link to plan |
| Approvals / leave admin display | Show OIC name |
| Settings notifications | New toggles + days_before |

Follow Material Tailwind + existing form patterns (`SearchableSelect`, floating labels).

## 9. Architecture sketch

```
Employee UI (/leave-plan)
    → LeavePlanService (CRUD, day count, overlap, soft entitlement warning)
    → leave_plans

Employee UI (/leave apply)
    → LeaveService.Create (+ oic_staff_id validation)
    → leave_requests.oic_staff_id

Admin “Send reminders” / cron
    → NotificationService leave plan + leave start scanners
    → InAppNotificationService (dedupe_key)
    → Employee + primary supervisor users
```

Units stay separate: plan CRUD does not call leave submit; reminders only read plans/requests; OIC is a field on leave requests only.

## 10. Error handling

| Case | Behaviour |
|------|-----------|
| Plan overlap | 422 with message |
| End before start / outside year | 422 |
| OIC missing / self / unknown | 422 on leave create |
| Reminder: no user for staff | Skip employee notify; still try supervisor if resolvable |
| Reminder: no primary supervisor | Notify employee only |

## 11. Testing

- Unit/service: day count, overlap rejection, OIC validation, reminder date matching + dedupe.
- API smoke: CRUD own plans; cannot edit another staff’s plan; leave create rejects without OIC.
- Manual: UI year list, soft entitlement warning, notification after running send-reminders with a plan starting in 7 days (or clock-skew test helper).

## 12. Rollout

1. Migration + models + permissions seeder.
2. LeavePlan service + mobile routes.
3. OIC column + leave create/list changes.
4. Reminder scanners + settings.
5. Frontend Leave plan page + Leave OIC + Settings.
6. Rebuild/redeploy frontend+API; document in `leave.md` §6.1 briefly.

## 13. Decisions locked

| Topic | Decision |
|-------|----------|
| Plan vs request | Plan only; apply separately |
| Reminder sources | Both plan blocks and approved/completed leave requests |
| Reminder offsets | 7 and 1 day before start (configurable string `"7,1"`) |
| Reminder audience | Employee + primary supervisor |
| OIC | Required on new leave applications |
| Balance | Plans never debit balances |
| Year bounds | Start and end must lie in selected calendar year |
| Team view | Read-only for supervisors/HR in v1 |

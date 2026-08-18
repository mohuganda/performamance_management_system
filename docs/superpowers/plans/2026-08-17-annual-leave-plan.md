# Annual Leave Plan, Reminders, and OIC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship plan-only annual leave planning, employee+supervisor leave-start reminders (plan and approved requests at 7/1 days), and a required OIC field on leave applications.

**Architecture:** New `leave_plans` table + `LeavePlanService` for CRUD (no balance debit, no approvals). Extend `leave_requests` with `oic_staff_id` and validate on create. Extend `NotificationService.SendAllReminders` to upsert in-app notifications (dedupe keys) for employees and primary supervisors. Frontend: `/leave-plan` page under Out of Station & Leave, plus OIC on `/leave`.

**Tech Stack:** Goravel/Go API, MySQL, React + TypeScript, Material Tailwind, TanStack Query, existing RBAC + `user_notifications`.

**Spec:** `docs/superpowers/specs/2026-08-17-annual-leave-plan-design.md`

## Global Constraints

- Plans are **annual leave planning only** — never convert to requests; never debit `leave_balances`.
- Plan start and end dates must both fall in the selected calendar year.
- Overlapping plan blocks for the same staff are rejected (422).
- Entitlement overrun is a **soft warning** in API response / UI — save still allowed.
- OIC is **required** on new leave creates; cannot be self.
- Reminders: plan blocks **and** leave requests with `status=approved` or `approval_stage=completed`; offsets default `"7,1"`; audience = employee + primary supervisor (sequence 1).
- Dedupe keys: `leave_plan:{id}:d{n}` and `leave_request:{id}:d{n}`.
- Prefer mobile API under `/api/v1/mobile/...` consistent with leave requests.
- Follow existing Goravel migration / facade / permission patterns; do not restructure unrelated modules.
- Git commits may fail if `.git/objects` dirs are root-owned — fix with `sudo chown -R "$(whoami)" .git` before committing; never use `--no-verify`.

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/database/migrations/20260817000001_leave_plans_and_oic.go` | `leave_plans` table + `leave_requests.oic_staff_id` |
| `backend/bootstrap/migrations.go` | Register migration |
| `backend/app/models/pms.go` | `LeavePlan` model; `OicStaffID` on `LeaveRequest` |
| `backend/app/services/leave_plan_helpers.go` | Pure helpers: day count, year bounds, overlap, parse offsets |
| `backend/app/services/leave_plan_helpers_test.go` | Unit tests for helpers |
| `backend/app/services/leave_plan_service.go` | CRUD + team list + entitlement warning |
| `backend/app/http/controllers/leave_plan_controller.go` | Mobile HTTP handlers |
| `backend/app/services/leave_service.go` | Accept/validate `OicStaffID` on create; enrich list rows |
| `backend/app/http/controllers/mobile_controller.go` | Bind `oic_staff_id`; OIC candidates endpoint |
| `backend/app/services/leave_reminder_service.go` | Scan plans/requests and notify |
| `backend/app/services/notification_service.go` | Call leave reminders from `SendAllReminders` |
| `backend/app/services/in_app_notification_service.go` | Public `Notify(...)` wrapping `upsert` |
| `backend/app/services/settings_service.go` | Expose leave reminder settings |
| `backend/database/seeders/rbac_seeder.go` | New permissions + role grants |
| `backend/routes/api.go` | Wire leave-plan + OIC candidate routes |
| `frontend/src/api/services/leavePlan.ts` | API client |
| `frontend/src/api/services/mobile.ts` | OIC on create + candidates helper |
| `frontend/src/modules/leave/LeavePlanPage.tsx` | Own + team plan UI |
| `frontend/src/modules/leave/LeavePage.tsx` | OIC field + link to plan |
| `frontend/src/app/navigation/navItems.ts` | Nav item |
| `frontend/src/app/routes/AppRoutes.tsx` | Route |
| `leave.md` | Brief §6.1 note |

---

### Task 1: Migration, model, and pure plan helpers (TDD)

**Files:**
- Create: `backend/database/migrations/20260817000001_leave_plans_and_oic.go`
- Modify: `backend/bootstrap/migrations.go`
- Modify: `backend/app/models/pms.go` (after `LeaveRequest` / near leave models)
- Create: `backend/app/services/leave_plan_helpers.go`
- Create: `backend/app/services/leave_plan_helpers_test.go`

**Interfaces:**
- Consumes: existing Goravel schema + `orm.Model` patterns
- Produces:
  - `type LeavePlan struct` with fields below
  - `LeaveRequest.OicStaffID *uint`
  - `func LeavePlanDayCount(start, end time.Time) int`
  - `func LeavePlanDatesInYear(start, end time.Time, year int) error`
  - `func LeavePlansOverlap(aStart, aEnd, bStart, bEnd time.Time) bool`
  - `func ParseReminderDayOffsets(raw string) []int`

- [ ] **Step 1: Write failing helper tests**

Create `backend/app/services/leave_plan_helpers_test.go`:

```go
package services

import (
	"testing"
	"time"
)

func TestLeavePlanDayCountInclusive(t *testing.T) {
	start := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 3, 3, 0, 0, 0, 0, time.UTC)
	if got := LeavePlanDayCount(start, end); got != 3 {
		t.Fatalf("got %d want 3", got)
	}
}

func TestLeavePlanDatesInYear(t *testing.T) {
	start := time.Date(2026, 12, 20, 0, 0, 0, 0, time.UTC)
	end := time.Date(2027, 1, 5, 0, 0, 0, 0, time.UTC)
	if err := LeavePlanDatesInYear(start, end, 2026); err == nil {
		t.Fatal("expected year bound error")
	}
	okStart := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	okEnd := time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC)
	if err := LeavePlanDatesInYear(okStart, okEnd, 2026); err != nil {
		t.Fatalf("unexpected: %v", err)
	}
}

func TestLeavePlansOverlap(t *testing.T) {
	a0 := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
	a1 := time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC)
	b0 := time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC)
	b1 := time.Date(2026, 5, 15, 0, 0, 0, 0, time.UTC)
	if !LeavePlansOverlap(a0, a1, b0, b1) {
		t.Fatal("touching inclusive ranges should overlap")
	}
	c0 := time.Date(2026, 5, 11, 0, 0, 0, 0, time.UTC)
	c1 := time.Date(2026, 5, 15, 0, 0, 0, 0, time.UTC)
	if LeavePlansOverlap(a0, a1, c0, c1) {
		t.Fatal("adjacent exclusive should not overlap")
	}
}

func TestParseReminderDayOffsets(t *testing.T) {
	got := ParseReminderDayOffsets("7,1")
	if len(got) != 2 || got[0] != 7 || got[1] != 1 {
		t.Fatalf("got %#v", got)
	}
	got = ParseReminderDayOffsets(" 7, 1, 7, -2, x ")
	if len(got) != 2 || got[0] != 7 || got[1] != 1 {
		t.Fatalf("dedupe/filter failed: %#v", got)
	}
}
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd backend && go test ./app/services -run 'LeavePlan|ParseReminder' -count=1
```

Expected: FAIL — undefined functions.

- [ ] **Step 3: Implement helpers**

Create `backend/app/services/leave_plan_helpers.go`:

```go
package services

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

func LeavePlanDayCount(start, end time.Time) int {
	s := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)
	e := time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, time.UTC)
	if e.Before(s) {
		return 0
	}
	return int(e.Sub(s).Hours()/24) + 1
}

func LeavePlanDatesInYear(start, end time.Time, year int) error {
	if end.Before(start) {
		return fmt.Errorf("end date must be on or after start date")
	}
	if start.Year() != year || end.Year() != year {
		return fmt.Errorf("start and end dates must both fall in calendar year %d", year)
	}
	return nil
}

func LeavePlansOverlap(aStart, aEnd, bStart, bEnd time.Time) bool {
	a0 := time.Date(aStart.Year(), aStart.Month(), aStart.Day(), 0, 0, 0, 0, time.UTC)
	a1 := time.Date(aEnd.Year(), aEnd.Month(), aEnd.Day(), 0, 0, 0, 0, time.UTC)
	b0 := time.Date(bStart.Year(), bStart.Month(), bStart.Day(), 0, 0, 0, 0, time.UTC)
	b1 := time.Date(bEnd.Year(), bEnd.Month(), bEnd.Day(), 0, 0, 0, 0, time.UTC)
	return !a1.Before(b0) && !b1.Before(a0)
}

func ParseReminderDayOffsets(raw string) []int {
	seen := map[int]bool{}
	var out []int
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		n, err := strconv.Atoi(part)
		if err != nil || n < 0 || seen[n] {
			continue
		}
		seen[n] = true
		out = append(out, n)
	}
	return out
}
```

- [ ] **Step 4: Re-run helper tests — expect PASS**

```bash
cd backend && go test ./app/services -run 'LeavePlan|ParseReminder' -count=1
```

Expected: PASS.

- [ ] **Step 5: Add migration**

Create `backend/database/migrations/20260817000001_leave_plans_and_oic.go`:

```go
package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20260817000001LeavePlansAndOic struct{}

func (r *M20260817000001LeavePlansAndOic) Signature() string {
	return "20260817000001_leave_plans_and_oic"
}

func (r *M20260817000001LeavePlansAndOic) Up() error {
	if !facades.Schema().HasTable("leave_plans") {
		if err := facades.Schema().Create("leave_plans", func(table schema.Blueprint) {
			table.ID()
			table.UnsignedBigInteger("staff_id")
			table.Integer("calendar_year")
			table.Date("start_date")
			table.Date("end_date")
			table.Integer("days_planned")
			table.Text("notes").Nullable()
			table.Timestamps()
			table.Index("staff_id", "calendar_year")
			table.Index("start_date")
		}); err != nil {
			return err
		}
	}
	if facades.Schema().HasTable("leave_requests") && !facades.Schema().HasColumn("leave_requests", "oic_staff_id") {
		if err := facades.Schema().Table("leave_requests", func(table schema.Blueprint) {
			table.UnsignedBigInteger("oic_staff_id").Nullable()
			table.Index("oic_staff_id")
		}); err != nil {
			return err
		}
	}
	return nil
}

func (r *M20260817000001LeavePlansAndOic) Down() error {
	if facades.Schema().HasTable("leave_requests") && facades.Schema().HasColumn("leave_requests", "oic_staff_id") {
		_ = facades.Schema().Table("leave_requests", func(table schema.Blueprint) {
			table.DropColumn("oic_staff_id")
		})
	}
	if facades.Schema().HasTable("leave_plans") {
		return facades.Schema().DropIfExists("leave_plans")
	}
	return nil
}
```

Register in `backend/bootstrap/migrations.go` after the leave-manager flag entry:

```go
&migrations.M20260733000001StaffLeaveManagerFlag{},
&migrations.M20260817000001LeavePlansAndOic{},
```

- [ ] **Step 6: Add models**

In `backend/app/models/pms.go`, add `OicStaffID *uint` to `LeaveRequest`, and add:

```go
type LeavePlan struct {
	orm.Model
	StaffID      uint
	CalendarYear int
	StartDate    time.Time
	EndDate      time.Time
	DaysPlanned  int
	Notes        *string
}

func (LeavePlan) TableName() string { return "leave_plans" }
```

- [ ] **Step 7: Commit**

```bash
git add backend/database/migrations/20260817000001_leave_plans_and_oic.go \
  backend/bootstrap/migrations.go backend/app/models/pms.go \
  backend/app/services/leave_plan_helpers.go \
  backend/app/services/leave_plan_helpers_test.go
git commit -m "$(cat <<'EOF'
Add leave plan helpers, migration, and OIC column scaffold.

EOF
)"
```

---

### Task 2: LeavePlanService CRUD + team listing

**Files:**
- Create: `backend/app/services/leave_plan_service.go`
- Test: extend helpers tests if needed; manual API check in Task 3

**Interfaces:**
- Consumes: `LeavePlanDayCount`, `LeavePlanDatesInYear`, `LeavePlansOverlap`, `LeaveService.BalanceRows`, `FindUserIDByStaffID` (later), supervisor tables
- Produces:
  - `type LeavePlanService struct`
  - `type LeavePlanInput struct { StartDate, EndDate time.Time; Notes string; CalendarYear int }`
  - `type LeavePlanRow struct` JSON fields: `id`, `staff_id`, `staff_name`, `calendar_year`, `start_date`, `end_date`, `days_planned`, `notes`, `entitlement_warning` (bool, list-level optional)
  - `type LeavePlanSaveResult struct { Plan LeavePlanRow; EntitlementWarning bool; WarningMessage string }`
  - `func (s *LeavePlanService) ListForStaff(staffID uint, year int) ([]LeavePlanRow, error)`
  - `func (s *LeavePlanService) Create(staffID uint, in LeavePlanInput) (LeavePlanSaveResult, error)`
  - `func (s *LeavePlanService) Update(staffID, planID uint, in LeavePlanInput) (LeavePlanSaveResult, error)`
  - `func (s *LeavePlanService) Delete(staffID, planID uint) error`
  - `func (s *LeavePlanService) ListTeam(viewerStaffID uint, year int) ([]LeavePlanRow, error)`

- [ ] **Step 1: Implement `LeavePlanService`**

Create `backend/app/services/leave_plan_service.go` with:

```go
package services

import (
	"fmt"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type LeavePlanService struct {
	leave *LeaveService
}

func NewLeavePlanService() *LeavePlanService {
	return &LeavePlanService{leave: NewLeaveService()}
}

type LeavePlanInput struct {
	CalendarYear int
	StartDate    time.Time
	EndDate      time.Time
	Notes        string
}

type LeavePlanRow struct {
	ID            uint   `json:"id"`
	StaffID       uint   `json:"staff_id"`
	StaffName     string `json:"staff_name,omitempty"`
	CalendarYear  int    `json:"calendar_year"`
	StartDate     string `json:"start_date"`
	EndDate       string `json:"end_date"`
	DaysPlanned   int    `json:"days_planned"`
	Notes         string `json:"notes,omitempty"`
}

type LeavePlanSaveResult struct {
	Plan               LeavePlanRow `json:"plan"`
	EntitlementWarning bool         `json:"entitlement_warning"`
	WarningMessage     string       `json:"warning_message,omitempty"`
}

func (s *LeavePlanService) ListForStaff(staffID uint, year int) ([]LeavePlanRow, error) {
	if year <= 0 {
		year = time.Now().Year()
	}
	var rows []models.LeavePlan
	if err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("calendar_year", year).
		Order("start_date asc").
		Get(&rows); err != nil {
		return nil, err
	}
	out := make([]LeavePlanRow, 0, len(rows))
	for _, row := range rows {
		out = append(out, s.toRow(row, ""))
	}
	return out, nil
}

func (s *LeavePlanService) Create(staffID uint, in LeavePlanInput) (LeavePlanSaveResult, error) {
	if err := LeavePlanDatesInYear(in.StartDate, in.EndDate, in.CalendarYear); err != nil {
		return LeavePlanSaveResult{}, err
	}
	if err := s.assertNoOverlap(staffID, in.CalendarYear, in.StartDate, in.EndDate, 0); err != nil {
		return LeavePlanSaveResult{}, err
	}
	plan := models.LeavePlan{
		StaffID:      staffID,
		CalendarYear: in.CalendarYear,
		StartDate:    in.StartDate,
		EndDate:      in.EndDate,
		DaysPlanned:  LeavePlanDayCount(in.StartDate, in.EndDate),
		Notes:        strPtrIf(in.Notes),
	}
	if err := facades.Orm().Query().Create(&plan); err != nil {
		return LeavePlanSaveResult{}, err
	}
	return s.saveResult(staffID, plan), nil
}

func (s *LeavePlanService) Update(staffID, planID uint, in LeavePlanInput) (LeavePlanSaveResult, error) {
	var plan models.LeavePlan
	if err := facades.Orm().Query().Where("id", planID).Where("staff_id", staffID).First(&plan); err != nil || plan.ID == 0 {
		return LeavePlanSaveResult{}, fmt.Errorf("leave plan not found")
	}
	if err := LeavePlanDatesInYear(in.StartDate, in.EndDate, in.CalendarYear); err != nil {
		return LeavePlanSaveResult{}, err
	}
	if err := s.assertNoOverlap(staffID, in.CalendarYear, in.StartDate, in.EndDate, planID); err != nil {
		return LeavePlanSaveResult{}, err
	}
	plan.CalendarYear = in.CalendarYear
	plan.StartDate = in.StartDate
	plan.EndDate = in.EndDate
	plan.DaysPlanned = LeavePlanDayCount(in.StartDate, in.EndDate)
	plan.Notes = strPtrIf(in.Notes)
	if err := facades.Orm().Query().Save(&plan); err != nil {
		return LeavePlanSaveResult{}, err
	}
	return s.saveResult(staffID, plan), nil
}

func (s *LeavePlanService) Delete(staffID, planID uint) error {
	var plan models.LeavePlan
	if err := facades.Orm().Query().Where("id", planID).Where("staff_id", staffID).First(&plan); err != nil || plan.ID == 0 {
		return fmt.Errorf("leave plan not found")
	}
	_, err := facades.Orm().Query().Delete(&plan)
	return err
}

func (s *LeavePlanService) ListTeam(viewerStaffID uint, year int) ([]LeavePlanRow, error) {
	if year <= 0 {
		year = time.Now().Year()
	}
	// Staff whose primary supervisor (sequence 1, current) is the viewer.
	var links []models.StaffSupervisor
	if err := facades.Orm().Query().
		Where("supervisor_staff_id", viewerStaffID).
		Where("approval_sequence", 1).
		Where("is_current", true).
		Get(&links); err != nil {
		return nil, err
	}
	if len(links) == 0 {
		return []LeavePlanRow{}, nil
	}
	contractIDs := make([]uint, 0, len(links))
	for _, l := range links {
		contractIDs = append(contractIDs, l.StaffContractID)
	}
	var contracts []models.StaffContract
	_ = facades.Orm().Query().WhereIn("id", contractIDs).Where("contract_status", "active").Get(&contracts)
	staffIDs := make([]any, 0, len(contracts))
	for _, c := range contracts {
		staffIDs = append(staffIDs, c.StaffID)
	}
	if len(staffIDs) == 0 {
		return []LeavePlanRow{}, nil
	}
	var plans []models.LeavePlan
	if err := facades.Orm().Query().
		WhereIn("staff_id", staffIDs).
		Where("calendar_year", year).
		Order("start_date asc").
		Get(&plans); err != nil {
		return nil, err
	}
	staffMap := loadStaffByIDs(uintsFromAny(staffIDs))
	out := make([]LeavePlanRow, 0, len(plans))
	for _, p := range plans {
		name := ""
		if st, ok := staffMap[p.StaffID]; ok {
			name = staffDisplayName(st)
		}
		out = append(out, s.toRow(p, name))
	}
	return out, nil
}

func (s *LeavePlanService) assertNoOverlap(staffID uint, year int, start, end time.Time, excludeID uint) error {
	var existing []models.LeavePlan
	q := facades.Orm().Query().Where("staff_id", staffID).Where("calendar_year", year)
	_ = q.Get(&existing)
	for _, row := range existing {
		if excludeID > 0 && row.ID == excludeID {
			continue
		}
		if LeavePlansOverlap(start, end, row.StartDate, row.EndDate) {
			return fmt.Errorf("planned leave overlaps an existing block (%s to %s)",
				row.StartDate.Format("2006-01-02"), row.EndDate.Format("2006-01-02"))
		}
	}
	return nil
}

func (s *LeavePlanService) saveResult(staffID uint, plan models.LeavePlan) LeavePlanSaveResult {
	warning, msg := s.entitlementWarning(staffID, plan.CalendarYear)
	return LeavePlanSaveResult{
		Plan:               s.toRow(plan, ""),
		EntitlementWarning: warning,
		WarningMessage:     msg,
	}
}

func (s *LeavePlanService) entitlementWarning(staffID uint, year int) (bool, string) {
	var plans []models.LeavePlan
	_ = facades.Orm().Query().Where("staff_id", staffID).Where("calendar_year", year).Get(&plans)
	planned := 0
	for _, p := range plans {
		planned += p.DaysPlanned
	}
	rows, err := s.leave.BalanceRows(staffID, year)
	if err != nil {
		return false, ""
	}
	remaining := 0
	found := false
	for _, row := range rows {
		// BalanceRows includes leave type code/name — match annual by code if present.
		if row.LeaveTypeCode == "annual" || row.LeaveTypeName == "Annual leave" || row.LeaveTypeName == "Annual" {
			remaining = row.EntitledDays + row.CarriedOverDays - row.UsedDays
			found = true
			break
		}
	}
	if !found {
		return false, ""
	}
	if planned > remaining {
		return true, fmt.Sprintf("Planned days (%d) exceed remaining annual entitlement (%d).", planned, remaining)
	}
	return false, ""
}

func (s *LeavePlanService) toRow(plan models.LeavePlan, staffName string) LeavePlanRow {
	notes := ""
	if plan.Notes != nil {
		notes = *plan.Notes
	}
	return LeavePlanRow{
		ID:           plan.ID,
		StaffID:      plan.StaffID,
		StaffName:    staffName,
		CalendarYear: plan.CalendarYear,
		StartDate:    plan.StartDate.Format("2006-01-02"),
		EndDate:      plan.EndDate.Format("2006-01-02"),
		DaysPlanned:  plan.DaysPlanned,
		Notes:        notes,
	}
}

func uintsFromAny(ids []any) []uint {
	out := make([]uint, 0, len(ids))
	for _, id := range ids {
		if v, ok := id.(uint); ok {
			out = append(out, v)
		}
	}
	return out
}
```

**Note:** Inspect `LeaveBalanceRow` in `leave_service.go` and align field names (`LeaveTypeCode` / `Code` / `Name`) exactly — do not invent fields. If code is missing on the row, load the annual `LeaveType` by `code = "annual"` and match `LeaveTypeID`.

- [ ] **Step 2: Fix compile against real `LeaveBalanceRow` and `StaffSupervisor` field tags**

```bash
cd backend && go build ./app/services/
```

Expected: SUCCESS. Adjust struct field names (`ApprovalSequence` vs `approval_sequence` column tag, `IsCurrent`) to match `models.StaffSupervisor` in `pms.go`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/leave_plan_service.go
git commit -m "$(cat <<'EOF'
Add LeavePlanService for annual leave plan CRUD.

EOF
)"
```

---

### Task 3: RBAC, controller, routes

**Files:**
- Modify: `backend/database/seeders/rbac_seeder.go`
- Create: `backend/app/http/controllers/leave_plan_controller.go`
- Modify: `backend/routes/api.go`

**Interfaces:**
- Consumes: `LeavePlanService` methods from Task 2; `staffIDFromContext`
- Produces: HTTP endpoints listed below; permissions `leave.plans.view`, `leave.plans.manage`, `leave.plans.view_team`

- [ ] **Step 1: Seed permissions and grants**

In `seedPermissions()`, add:

```go
{Code: "leave.plans.view", Module: "leave", Action: "view", Name: "View own annual leave plan"},
{Code: "leave.plans.manage", Module: "leave", Action: "manage", Name: "Manage own annual leave plan"},
{Code: "leave.plans.view_team", Module: "leave", Action: "view", Name: "View team annual leave plans"},
```

In `seedRolePermissions()` matrix, add:

- `staff`: `leave.plans.view`, `leave.plans.manage`
- `supervisor`, `department_head`, `director`, `permanent_secretary`: those plus `leave.plans.view_team` (and leave view/approve as already present)
- `hr_officer`, `admin`: `leave.plans.view`, `leave.plans.manage`, `leave.plans.view_team`

Run seeder in deploy/API container after code ships, e.g.:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env exec api ./artisan db:seed --seeder RbacSeeder
```

(Use the project’s actual artisan seed invocation if different.)

- [ ] **Step 2: Controller**

Create `backend/app/http/controllers/leave_plan_controller.go`:

```go
package controllers

import (
	"strconv"
	"time"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/services"
)

type LeavePlanController struct {
	plans *services.LeavePlanService
}

func NewLeavePlanController() *LeavePlanController {
	return &LeavePlanController{plans: services.NewLeavePlanService()}
}

type leavePlanBody struct {
	CalendarYear int    `json:"calendar_year"`
	StartDate    string `json:"start_date"`
	EndDate      string `json:"end_date"`
	Notes        string `json:"notes"`
}

func (c *LeavePlanController) ListMine(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	year, _ := strconv.Atoi(ctx.Request().Query("year", strconv.Itoa(time.Now().Year())))
	rows, err := c.plans.ListForStaff(staffID, year)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

func (c *LeavePlanController) ListTeam(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	year, _ := strconv.Atoi(ctx.Request().Query("year", strconv.Itoa(time.Now().Year())))
	rows, err := c.plans.ListTeam(staffID, year)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

func (c *LeavePlanController) Create(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	in, err := bindLeavePlanBody(ctx)
	if err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": err.Error()})
	}
	res, err := c.plans.Create(staffID, in)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Status(http.StatusCreated).Json(res)
}

func (c *LeavePlanController) Update(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	id, _ := strconv.Atoi(ctx.Request().Route("id"))
	in, err := bindLeavePlanBody(ctx)
	if err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": err.Error()})
	}
	res, err := c.plans.Update(staffID, uint(id), in)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(res)
}

func (c *LeavePlanController) Delete(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	id, _ := strconv.Atoi(ctx.Request().Route("id"))
	if err := c.plans.Delete(staffID, uint(id)); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"ok": true})
}

func bindLeavePlanBody(ctx http.Context) (services.LeavePlanInput, error) {
	var body leavePlanBody
	if err := ctx.Request().Bind(&body); err != nil {
		return services.LeavePlanInput{}, err
	}
	start, err1 := time.Parse("2006-01-02", body.StartDate)
	end, err2 := time.Parse("2006-01-02", body.EndDate)
	if err1 != nil || err2 != nil {
		return services.LeavePlanInput{}, err1
	}
	year := body.CalendarYear
	if year <= 0 {
		year = start.Year()
	}
	return services.LeavePlanInput{
		CalendarYear: year,
		StartDate:    start,
		EndDate:      end,
		Notes:        body.Notes,
	}, nil
}
```

Fix `bindLeavePlanBody` to return a clear error when either date parse fails (`fmt.Errorf("start_date and end_date must be YYYY-MM-DD")`).

- [ ] **Step 3: Register routes in `backend/routes/api.go`**

Inside the authenticated `mobile` group (near leave routes):

```go
leavePlanController := controllers.NewLeavePlanController()
mobile.Middleware(middleware.Permission("leave.plans.view")).Get("/leave-plans", leavePlanController.ListMine)
mobile.Middleware(middleware.Permission("leave.plans.view_team")).Get("/leave-plans/team", leavePlanController.ListTeam)
mobile.Middleware(middleware.Permission("leave.plans.manage")).Post("/leave-plans", leavePlanController.Create)
mobile.Middleware(middleware.Permission("leave.plans.manage")).Put("/leave-plans/{id}", leavePlanController.Update)
mobile.Middleware(middleware.Permission("leave.plans.manage")).Delete("/leave-plans/{id}", leavePlanController.Delete)
```

- [ ] **Step 4: Build API and migrate**

```bash
cd backend && go build ./...
# then in running stack, migrate + reseed RBAC
```

Smoke with a staff JWT:

```bash
curl -s -H "Authorization: Bearer $TOKEN" 'http://127.0.0.1:8081/api/v1/mobile/leave-plans?year=2026'
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"calendar_year":2026,"start_date":"2026-08-20","end_date":"2026-08-25","notes":"Family"}' \
  'http://127.0.0.1:8081/api/v1/mobile/leave-plans'
```

Expected: `[]` then `201` with `plan` object.

- [ ] **Step 5: Commit**

```bash
git add backend/database/seeders/rbac_seeder.go \
  backend/app/http/controllers/leave_plan_controller.go \
  backend/routes/api.go
git commit -m "$(cat <<'EOF'
Expose annual leave plan APIs and RBAC permissions.

EOF
)"
```

---

### Task 4: OIC on leave requests + candidate search for staff

**Files:**
- Modify: `backend/app/services/leave_service.go`
- Modify: `backend/app/http/controllers/mobile_controller.go`
- Modify: `backend/routes/api.go`
- Modify: list/pending/admin payloads that serialize leave requests (enrich with `oic_name` where rows are mapped)

**Interfaces:**
- Consumes: `CreateLeaveInput` + `SupervisorService.ListSupervisorCandidates`
- Produces: required `oic_staff_id` on create; `GET /mobile/leave/oic-candidates`

- [ ] **Step 1: Extend `CreateLeaveInput` and `CreateDraft`**

```go
type CreateLeaveInput struct {
	StaffID          uint
	LeaveTypeID      uint
	StartDate        time.Time
	EndDate          time.Time
	Reason           string
	MedicalReportURL string
	OicStaffID       uint
}

func (s *LeaveService) CreateDraft(input CreateLeaveInput) (models.LeaveRequest, error) {
	// existing validations...
	if input.OicStaffID == 0 {
		return models.LeaveRequest{}, fmt.Errorf("officer in charge (OIC) is required")
	}
	if input.OicStaffID == input.StaffID {
		return models.LeaveRequest{}, fmt.Errorf("OIC cannot be the same as the leave applicant")
	}
	var oic models.Staff
	if err := facades.Orm().Query().Where("id", input.OicStaffID).First(&oic); err != nil || oic.ID == 0 {
		return models.LeaveRequest{}, fmt.Errorf("OIC staff record not found")
	}
	// when building req:
	oicID := input.OicStaffID
	req.OicStaffID = &oicID
	// ...
}
```

- [ ] **Step 2: Bind in mobile controller**

```go
type leaveRequestBody struct {
	LeaveTypeID      uint   `json:"leave_type_id"`
	StartDate        string `json:"start_date"`
	EndDate          string `json:"end_date"`
	Reason           string `json:"reason"`
	MedicalReportURL string `json:"medical_report_url"`
	OicStaffID       uint   `json:"oic_staff_id"`
	Submit           bool   `json:"submit"`
}
```

Pass `OicStaffID: body.OicStaffID` into `CreateDraft`.

Add handler:

```go
func (c *MobileController) ListOicCandidates(ctx http.Context) http.Response {
	staffID, _ := staffIDFromContext(ctx)
	candidates, err := services.NewSupervisorService().ListSupervisorCandidates()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	out := make([]services.SupervisorCandidate, 0, len(candidates))
	for _, cnd := range candidates {
		if cnd.StaffID == staffID {
			continue
		}
		out = append(out, cnd)
	}
	return ctx.Response().Success().Json(out)
}
```

Route (permission `leave.requests.create` or `leave.requests.view`):

```go
mobile.Middleware(middleware.Permission("leave.requests.create")).Get("/leave/oic-candidates", mobileController.ListOicCandidates)
```

- [ ] **Step 3: Enrich leave list responses with `oic_name`**

Wherever leave requests are returned as maps/DTOs for mobile list, pending approvals, and leave admin request rows, join `oic_staff_id` → staff display name as `oic_name`. If raw models are returned today, add a thin mapper in `LeaveService.ListForStaff` returning enriched JSON-friendly structs (preferred) without breaking mobile clients that already ignore unknown fields.

- [ ] **Step 4: Verify**

```bash
cd backend && go build ./...
# POST leave without oic_staff_id → 422
# POST with oic_staff_id of self → 422
# POST with valid oic → 201 and oic_staff_id set
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/leave_service.go \
  backend/app/http/controllers/mobile_controller.go \
  backend/routes/api.go
# plus any admin/approval enrichment files touched
git commit -m "$(cat <<'EOF'
Require OIC on leave applications and expose candidates API.

EOF
)"
```

---

### Task 5: Leave start / plan reminders + settings

**Files:**
- Modify: `backend/app/services/in_app_notification_service.go`
- Create: `backend/app/services/leave_reminder_service.go`
- Create: `backend/app/services/leave_reminder_helpers_test.go` (optional small test for target date matching)
- Modify: `backend/app/services/notification_service.go`
- Modify: `backend/app/services/settings_service.go` (`notificationsConfig` + defaults map if present)

**Interfaces:**
- Consumes: `ParseReminderDayOffsets`, `FindUserIDByStaffID`, primary supervisor lookup, `InAppNotificationService.Notify`
- Produces: `LeaveReminderService.SendPlanReminders() / SendApprovedLeaveReminders()`; settings keys from spec

- [ ] **Step 1: Public Notify wrapper**

In `in_app_notification_service.go`:

```go
func (s *InAppNotificationService) Notify(userID uint, notifType, category, title, message, dedupeKey, actionURL string) error {
	return s.upsert(userID, notifType, category, title, message, dedupeKey, actionURL)
}
```

- [ ] **Step 2: Implement reminder service**

```go
package services

import (
	"fmt"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type LeaveReminderService struct {
	settings *SettingsService
	inApp    *InAppNotificationService
}

func NewLeaveReminderService() *LeaveReminderService {
	return &LeaveReminderService{
		settings: NewSettingsService(),
		inApp:    NewInAppNotificationService(),
	}
}

func (s *LeaveReminderService) SendAll() (map[string]ReminderSendResult, error) {
	out := map[string]ReminderSendResult{}
	if s.settings.GetBool("notifications.leave_plan_reminder.enabled", true) {
		out["leave_plan_reminder"] = s.sendPlanReminders()
	}
	if s.settings.GetBool("notifications.leave_start_reminder.enabled", true) {
		out["leave_start_reminder"] = s.sendApprovedLeaveReminders()
	}
	return out, nil
}

func (s *LeaveReminderService) offsets() []int {
	raw := s.settings.GetString("notifications.leave_reminder.days_before", "7,1")
	offsets := ParseReminderDayOffsets(raw)
	if len(offsets) == 0 {
		return []int{7, 1}
	}
	return offsets
}

func (s *LeaveReminderService) sendPlanReminders() ReminderSendResult {
	result := ReminderSendResult{}
	today := time.Now().UTC().Truncate(24 * time.Hour)
	for _, d := range s.offsets() {
		target := today.AddDate(0, 0, d)
		var plans []models.LeavePlan
		_ = facades.Orm().Query().Where("start_date", target.Format("2006-01-02")).Get(&plans)
		// If driver compares dates poorly, filter in Go by Y-M-D equality.
		for _, plan := range plans {
			if plan.StartDate.Format("2006-01-02") != target.Format("2006-01-02") {
				continue
			}
			dedupe := fmt.Sprintf("leave_plan:%d:d%d", plan.ID, d)
			title := "Upcoming planned leave"
			msg := fmt.Sprintf("Your annual leave plan starts on %s (in %d day(s)).", plan.StartDate.Format("2006-01-02"), d)
			s.notifyStaffAndPrimarySupervisor(plan.StaffID, "leave_plan_reminder", "leave", title, msg, dedupe, "/leave-plan", &result)
		}
	}
	return result
}

func (s *LeaveReminderService) sendApprovedLeaveReminders() ReminderSendResult {
	result := ReminderSendResult{}
	today := time.Now().UTC().Truncate(24 * time.Hour)
	for _, d := range s.offsets() {
		target := today.AddDate(0, 0, d)
		var reqs []models.LeaveRequest
		_ = facades.Orm().Query().Get(&reqs) // filter in Go for date + status to avoid dialect issues
		for _, req := range reqs {
			if req.StartDate.Format("2006-01-02") != target.Format("2006-01-02") {
				continue
			}
			if req.Status != "approved" && req.ApprovalStage != "completed" {
				continue
			}
			dedupe := fmt.Sprintf("leave_request:%d:d%d", req.ID, d)
			title := "Upcoming approved leave"
			msg := fmt.Sprintf("Your approved leave starts on %s (in %d day(s)).", req.StartDate.Format("2006-01-02"), d)
			s.notifyStaffAndPrimarySupervisor(req.StaffID, "leave_start_reminder", "leave", title, msg, dedupe, "/leave", &result)
		}
	}
	return result
}

func (s *LeaveReminderService) notifyStaffAndPrimarySupervisor(
	staffID uint,
	notifType, category, title, message, dedupe, actionURL string,
	result *ReminderSendResult,
) {
	if userID, err := FindUserIDByStaffID(staffID); err == nil && userID > 0 {
		if err := s.inApp.Notify(userID, notifType, category, title, message, dedupe+":emp", actionURL); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, err.Error())
		} else {
			result.Sent++
		}
	}
	supervisorID, err := primarySupervisorStaffID(staffID)
	if err != nil || supervisorID == 0 {
		return
	}
	var emp models.Staff
	_ = facades.Orm().Query().Where("id", staffID).First(&emp)
	supTitle := title
	supMsg := fmt.Sprintf("%s has leave starting on the planned/approved date noted (in reminder window). %s", staffDisplayName(emp), message)
	if userID, err := FindUserIDByStaffID(supervisorID); err == nil && userID > 0 {
		if err := s.inApp.Notify(userID, notifType, category, supTitle, supMsg, dedupe+":sup", actionURL); err != nil {
			result.Failed++
		} else {
			result.Sent++
		}
	}
}

func primarySupervisorStaffID(staffID uint) (uint, error) {
	contract, err := NewSupervisorService().activeContract(staffID)
	// activeContract may be unexported — if so, duplicate the active-contract lookup here using public patterns from SupervisorService.GetStaffSupervisors.
	if err != nil || contract.ID == 0 {
		return 0, err
	}
	var link models.StaffSupervisor
	err = facades.Orm().Query().
		Where("staff_contract_id", contract.ID).
		Where("approval_sequence", 1).
		Where("is_current", true).
		First(&link)
	if err != nil || link.ID == 0 {
		return 0, err
	}
	return link.SupervisorStaffID, nil
}
```

If `activeContract` is unexported, implement `primarySupervisorStaffID` using the same query pattern already used inside `SupervisorService` (copy the active contract `Where` clauses from `activeContract`).

Tighten supervisor message copy to:  
`"{Name} has leave starting on {date} (in {n} day(s))."`

- [ ] **Step 3: Hook into `SendAllReminders`**

```go
leaveRem := NewLeaveReminderService()
leaveOut, _ := leaveRem.SendAll()
for k, v := range leaveOut {
	out[k] = v
}
```

- [ ] **Step 4: Settings exposure**

In `notificationsConfig()` add:

```go
"leave_plan_reminder": map[string]any{
	"enabled":     s.GetBool("notifications.leave_plan_reminder.enabled", true),
	"days_before": s.GetString("notifications.leave_reminder.days_before", "7,1"),
	"description": "Remind employees and primary supervisors before planned annual leave starts",
},
"leave_start_reminder": map[string]any{
	"enabled":     s.GetBool("notifications.leave_start_reminder.enabled", true),
	"days_before": s.GetString("notifications.leave_reminder.days_before", "7,1"),
	"description": "Remind employees and primary supervisors before approved leave starts",
},
```

If there is a defaults map used by EnsureDefaults/seed, add the three keys there too.

- [ ] **Step 5: Build + manual reminder smoke**

Create a plan with `start_date = today+7`, run Settings → Send reminders, confirm notifications for employee (+ supervisor if linked).

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/in_app_notification_service.go \
  backend/app/services/leave_reminder_service.go \
  backend/app/services/notification_service.go \
  backend/app/services/settings_service.go
git commit -m "$(cat <<'EOF'
Add leave plan and approved-leave start reminders.

EOF
)"
```

---

### Task 6: Frontend Leave Plan page + nav

**Files:**
- Create: `frontend/src/api/services/leavePlan.ts`
- Create: `frontend/src/modules/leave/LeavePlanPage.tsx`
- Modify: `frontend/src/app/navigation/navItems.ts`
- Modify: `frontend/src/app/routes/AppRoutes.tsx`
- Modify: `frontend/src/components/organisms/ModuleQuickLinks.tsx` (if leave/oos listed)

**Interfaces:**
- Consumes: mobile leave-plan APIs; `hasPermission('leave.plans.*')`
- Produces: `/leave-plan` UI (My plan + Team tab when `leave.plans.view_team`)

- [ ] **Step 1: API client**

```ts
import apiClient from '../client'

export type LeavePlanRow = {
  id: number
  staff_id: number
  staff_name?: string
  calendar_year: number
  start_date: string
  end_date: string
  days_planned: number
  notes?: string
}

export type LeavePlanSaveResult = {
  plan: LeavePlanRow
  entitlement_warning: boolean
  warning_message?: string
}

export const leavePlanService = {
  listMine: async (year: number) => {
    const { data } = await apiClient.get<LeavePlanRow[]>('/mobile/leave-plans', { params: { year } })
    return data
  },
  listTeam: async (year: number) => {
    const { data } = await apiClient.get<LeavePlanRow[]>('/mobile/leave-plans/team', { params: { year } })
    return data
  },
  create: async (payload: {
    calendar_year: number
    start_date: string
    end_date: string
    notes?: string
  }) => {
    const { data } = await apiClient.post<LeavePlanSaveResult>('/mobile/leave-plans', payload)
    return data
  },
  update: async (
    id: number,
    payload: { calendar_year: number; start_date: string; end_date: string; notes?: string },
  ) => {
    const { data } = await apiClient.put<LeavePlanSaveResult>(`/mobile/leave-plans/${id}`, payload)
    return data
  },
  remove: async (id: number) => {
    const { data } = await apiClient.delete(`/mobile/leave-plans/${id}`)
    return data
  },
}
```

- [ ] **Step 2: Nav + route**

In `navItems.ts`, insert before Leave (or after Leave) in `time-attendance`:

```ts
{
  id: 'leave-plan',
  label: 'Leave plan',
  path: '/leave-plan',
  icon: CalendarDays, // or CalendarRange if already imported
  description: 'Plan annual leave blocks for the year',
  permission: 'leave.plans.view',
},
```

In `AppRoutes.tsx`:

```tsx
<Route
  path="leave-plan"
  element={
    <RequirePermission permission="leave.plans.view">
      <LeavePlanPage />
    </RequirePermission>
  }
/>
```

- [ ] **Step 3: Build `LeavePlanPage`**

Page structure (match `LeavePage` / MT patterns):

- `PageHeader` title “Annual leave plan”, subtitle about planning only (still apply via Leave).
- Year `<Select>` current + next year.
- Tabs or segmented control: **My plan** | **Team** (team only if `hasPermission('leave.plans.view_team')`).
- My plan: list cards/table of blocks; form with start/end/notes; Save calls create/update; Delete with confirm.
- On `entitlement_warning`, show warning toast/banner but keep the saved plan.
- Team: read-only table with staff name + dates.

Keep ProcessGuide optional or skip (not required by spec).

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npm run typecheck
# or: npx tsc --noEmit
```

Expected: no errors from new files.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/services/leavePlan.ts \
  frontend/src/modules/leave/LeavePlanPage.tsx \
  frontend/src/app/navigation/navItems.ts \
  frontend/src/app/routes/AppRoutes.tsx
git commit -m "$(cat <<'EOF'
Add annual leave plan page and navigation.

EOF
)"
```

---

### Task 7: Frontend OIC field, leave link, docs, deploy

**Files:**
- Modify: `frontend/src/api/services/mobile.ts`
- Modify: `frontend/src/modules/leave/LeavePage.tsx`
- Modify: leave admin / approvals display components that show request fields (add OIC name when present)
- Modify: `leave.md` §6.1
- Rebuild docker frontend/api as used locally on `:8081`

- [ ] **Step 1: Extend leaveService**

```ts
createRequest: async (payload: {
  leave_type_id: number
  start_date: string
  end_date: string
  reason: string
  medical_report_url?: string
  oic_staff_id: number
  submit: boolean
}) => { ... },

listOicCandidates: async () => {
  const { data } = await apiClient.get<Array<{ staff_id: number; name: string; job_title?: string }>>(
    '/mobile/leave/oic-candidates',
  )
  return data
},
```

Align candidate field names with actual `SupervisorCandidate` JSON (`staff_id`, `name`, `job_title`).

- [ ] **Step 2: LeavePage form**

- Add `oic_staff_id: ''` to form state.
- Load candidates with `useQuery(['leave', 'oic-candidates'], leaveService.listOicCandidates)`.
- Render required `SearchableSelect` labeled “Officer in charge (OIC)”.
- Client validation: block submit if empty.
- Pass `oic_staff_id: Number(form.oic_staff_id)` to create.
- Show `oic_name` on request list rows when API returns it.
- Add text link/button: “Manage annual leave plan” → `/leave-plan`.

- [ ] **Step 3: Docs**

In `leave.md` §6.1 add:

```markdown
PMS supports **annual leave plans** at `/leave-plan` (plan-only; staff still submit leave requests separately).
Leave applications require an **Officer in Charge (OIC)**. Employees and primary supervisors receive reminders 7 and 1 day before planned or approved leave starts (configurable).
```

- [ ] **Step 4: Deploy local stack**

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env --profile app build api frontend
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env --profile app up -d api frontend gateway
# migrate + rbac seed via api container
```

Hard-refresh browser; verify `/leave-plan`, OIC on `/leave`, Settings notifications cards include leave reminders.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/services/mobile.ts \
  frontend/src/modules/leave/LeavePage.tsx \
  leave.md
# plus any approvals/admin display files
git commit -m "$(cat <<'EOF'
Require OIC on leave UI and document leave plans.

EOF
)"
```

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| `leave_plans` table + indexes | 1 |
| Plan CRUD, year bounds, overlap, day count | 1–2 |
| Soft entitlement warning | 2 |
| Team read-only plans | 2–3, 6 |
| Permissions + routes | 3 |
| OIC required + candidates API | 4, 7 |
| Reminders plan + approved, 7/1, emp+supervisor, dedupe | 5 |
| Settings keys | 5 |
| Nav `/leave-plan` + LeavePage OIC | 6–7 |
| Non-goals (no convert, no package approval) | respected |

## Placeholder / consistency review

- Helper and service names are consistent (`LeavePlanDayCount`, `LeavePlanService`, `leavePlanService`).
- Reminder setting key for offsets is shared: `notifications.leave_reminder.days_before`.
- Dedupe suffixes `:emp` / `:sup` keep employee and supervisor notifications distinct under the same plan/request+day key.
- `activeContract` visibility: Task 5 explicitly requires copying public query if unexported.

---

**Plan complete and saved to `docs/superpowers/plans/2026-08-17-annual-leave-plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration  

**2. Inline Execution** — execute tasks in this session with executing-plans and checkpoints  

**Which approach?**

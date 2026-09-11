# Background Sync + HRM Attendance Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run iHRIS and HRM inbound sync as resumable background jobs (schedules + UI Resume), and export OOS attendance clocks to HRM via push/pull with `hrm_attend_export_log` dedupe and Basic Auth to `/api/outoftstation_clockin_post`.

**Architecture:** In-process sync runners with DB run status and process locks; Goravel schedule for 03:00 iHRIS, monthly HRM pull, daily export push; Settings Data sources drives Start/Resume/Cancel and export config.

**Tech Stack:** Goravel/Go, existing `IhrisSyncService` / `HrmAttendService`, React Settings, Postgres migrations.

**Spec:** `docs/superpowers/specs/2026-09-11-background-sync-hrm-export-design.md`

## Global Constraints

- Do not modify HRM’s existing `clock_user_post`; push only to `outoftstation_clockin_post` (or configured path).
- `source` on outbound payload = `performance_system`.
- Export dedupe via `hrm_attend_export_log` unique successful `attendance_clock_id`.
- Leaving the browser must not stop background sync.
- Do not commit unless the user asks (during execution).

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/database/migrations/20260911000005_hrm_export_and_sync_runs.go` | `hrm_attend_export_log`, `hrm_attend_sync_runs` |
| `backend/app/models/pms.go` | Models |
| `backend/app/services/sync_runner.go` | Process lock helpers |
| `backend/app/services/ihris_sync_runner.go` | Background iHRIS loop |
| `backend/app/services/hrm_attend_sync_runner.go` | Background HRM inbound |
| `backend/app/services/hrm_attend_export.go` | Push client + pull listing + log |
| `backend/app/http/controllers/ihris_controller.go` | start/resume/cancel |
| `backend/app/http/controllers/hrm_attend_controller.go` | sync + export endpoints |
| `backend/app/console/commands/*` | `ihris:sync`, `hrm-attend:sync`, `hrm-attend:export-push` |
| `backend/app/providers/backup_schedule_provider.go` or new `sync_schedule_provider.go` | Cron registration |
| `backend/app/services/settings_service.go` + seeder | New hrm_attend keys |
| `frontend/.../SettingsPage.tsx` + `admin.ts` | UI Resume/Cancel/export fields |
| `docs/api/hrm-attend-export.md` | Contract for Attend team |

---

### Task 1: Migrations + export log model + dedupe tests

**Files:** migration, models, `hrm_attend_export_dedupe_test.go`

- [ ] Create `hrm_attend_export_log` and `hrm_attend_sync_runs`.
- [ ] Unit test: `ShouldExportClock(clockID, logs) bool` — false if success exists.

### Task 2: HRM export push + pull API

**Files:** `hrm_attend_export.go`, controller, routes, settings keys

- [ ] Mapper from `AttendanceClock` + staff → payload JSON (`source=performance_system`).
- [ ] `PushPendingClocks(limit)` with Basic Auth; write log.
- [ ] `GET /integrations/hrm-attend/attendance-clocks` token auth; optional `mark_exported`.
- [ ] Settings: push path, basic auth, pull token, enable flag.
- [ ] Frontend fields + Push now button.

### Task 3: iHRIS background start/resume/cancel + 03:00 schedule

**Files:** runner, controller, command, schedule, Settings UI

- [ ] Replace browser while-loop with start + poll status.
- [ ] Resume/Cancel endpoints.
- [ ] `DailyAt("03:00")` + artisan `ihris:sync`.

### Task 4: HRM inbound background + monthly schedule

**Files:** runner, `hrm_attend_sync_runs`, command, schedule, UI

- [ ] Start/resume/cancel/status.
- [ ] Monthly 1st 00:15 previous month.
- [ ] Keep old `POST /hrm-attend/sync` as start alias.

### Task 5: Docs + verify

- [ ] `docs/api/hrm-attend-export.md` for Attend `outoftstation_clockin_post` clone + PMS pull.
- [ ] README / DEPLOYMENT schedule cron note.
- [ ] `go test` / `go build` / frontend tsc.

## Spec coverage

| Spec item | Task |
|-----------|------|
| Export log A | 1–2 |
| Push path + Basic Auth + source | 2 |
| Pull API | 2 |
| iHRIS background + 3am | 3 |
| HRM inbound + monthly | 4 |
| Docs for Attend clone endpoint | 5 |

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-11-background-sync-hrm-export.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh agent per task  
2. **Inline Execution** — this session with checkpoints  

Which approach?

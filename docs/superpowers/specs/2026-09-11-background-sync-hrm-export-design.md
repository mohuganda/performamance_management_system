# Background Sync + HRM Attendance Export — Design

**Date:** 2026-09-11  
**Status:** Approved for planning  
**Product:** MoH Uganda Performance Management System

## Problem

1. iHRIS and HRM Attend sync are driven by the browser; leaving Settings → Data sources stops work and abandoned runs can stick as `running`.
2. Sync should run on a schedule (iHRIS nightly, HRM inbound monthly) without an open tab.
3. PMS must share OOS/attendance clocks **to** HRM Attend (push + pull) without double-sending, using a new HRM endpoint modeled on `clock_user_post` (not modifying the existing one).

## Goals

1. Server-side background sync for **iHRIS** and **HRM inbound** with Start / Resume / Cancel + status UI.
2. Schedules: iHRIS **daily 03:00**; HRM summary sync **1st of month ~00:15** (previous month).
3. HRM **outbound**: push unsynced clocks to configurable URL (default `{api_url}/api/outoftstation_clockin_post`) with **HTTP Basic Auth**; **pull** API for HRM; **`hrm_attend_export_log`** dedupe.
4. Payload mirrors `clock_user_post` structure; `source` = `performance_system`. Do **not** modify HRM’s existing `clock_user_post`.

## Non-goals

- Implementing the HRM Attend PHP/Laravel route itself (Attend app must add `outoftstation_clockin_post` as a clone). PMS documents the contract and posts to it.
- Changing inbound monthly summary API shape from HRM.
- Redis queue workers (v1 uses in-process goroutine + DB status + schedule, same pattern as backups).

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Background sync | Approach 1 — server runner + DB status; not browser loop |
| Export tracking | Table `hrm_attend_export_log` keyed by `attendance_clock_id` |
| Push + pull | Both |
| Push path default | `{hrm_attend.api_url}/api/outoftstation_clockin_post` |
| Push auth | HTTP Basic (`basic_user` / `basic_password`) |
| Source field | `performance_system` |
| Existing HRM endpoint | Untouched (`clock_user_post`) |
| iHRIS schedule | Daily 03:00 |
| HRM inbound schedule | Monthly on day 1 at 00:15 |

## Workstream A — Background sync runners

### Shared pattern

- `Start` creates/continues a run row, returns immediately; worker advances in background (process lock: one run per integration).
- `Resume` continues last incomplete / given `run_id`.
- `Cancel` marks run cancelled; worker stops at next checkpoint.
- Settings UI polls status; leaving the page does **not** stop the job.

### iHRIS

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/ihris/sync/start` | Start or continue background run |
| POST | `/api/v1/ihris/sync/resume` | Resume stuck/incomplete run |
| POST | `/api/v1/ihris/sync/cancel` | Cancel |
| GET | `/api/v1/ihris/sync/status` | Existing status (keep) |

- Reuse `ihris_sync_runs` + batch logic from `IhrisSyncService`.
- Abandoned `running` older than N minutes: Resume allowed; Start may auto-resume or offer Resume.
- Schedule: Goravel `DailyAt("03:00")` → start if none running.
- Artisan: `ihris:sync` for cron fallback (`schedule:run`).

### HRM inbound (monthly summaries)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/hrm-attend/sync/start` | Background sync (optional `year_month`) |
| POST | `/api/v1/hrm-attend/sync/resume` | Resume failed/incomplete |
| POST | `/api/v1/hrm-attend/sync/cancel` | Cancel |
| GET | `/api/v1/hrm-attend/sync/status` | Status |
| POST | `/api/v1/hrm-attend/sync` | Keep for compatibility or thin-wrap to start |

- New lightweight run table or settings keys + `hrm_attend_sync_runs` (preferred for Resume).
- Schedule: cron `15 0 1 * *` / monthly at 00:15 → previous calendar month.
- Artisan: `hrm-attend:sync`.

## Workstream B — Outbound attendance to HRM

### Settings (`data_sources.hrm_attend`)

| Key | Purpose |
|-----|---------|
| `api_url` | Base (existing) |
| `export_push_enabled` | Toggle push |
| `export_push_path` | Default `/api/outoftstation_clockin_post` |
| `basic_user` / `basic_password` | Basic auth for push (and documented for HRM) |
| `export_pull_token` | Bearer/token for PMS pull API |
| `export_last_push_at` / `export_last_push_status` | Status display |

### Table `hrm_attend_export_log`

- `id`, `attendance_clock_id` (unique when status=success), `direction` (`push`|`pull`), `status` (`success`|`failed`), `http_status`, `response_snippet`, `exported_at`, timestamps.
- Unique success per clock prevents duplicate push.

### Push client (PMS → HRM)

1. Select `attendance_clocks` with no successful export log (optionally filter OOS-linked clocks only — default: all clocks that are OOS-verified **or** all mobile clocks; **v1: clocks with `out_of_station_request_id` set**, matching “outofstation_clockin”).
2. Map to payload (see below); set `source` = `performance_system`.
3. `POST` with Basic Auth to `{api_url}{export_push_path}`.
4. On 2xx → insert log success; on failure → log failed (allow retry).
5. Manual “Push now” in Settings + optional schedule (e.g. hourly or daily after iHRIS — **v1: on-demand + daily 03:30**).

### Pull API (HRM → PMS)

`GET /api/v1/integrations/hrm-attend/attendance-clocks?from=&to=&since_id=&mark_exported=false`

- Auth: `Authorization: Bearer {export_pull_token}` or `X-Hrm-Attend-Token`.
- Returns JSON list of clocks (same field set as push payload + `id`).
- If `mark_exported=true`, write success log rows so push won’t resend.

### Payload mapping (TBD refine against live `clock_user_post`)

Until Attend’s exact field names are confirmed, PMS posts a **clock_user_post-compatible** JSON object. Adjust keys via settings override later if needed.

```json
{
  "employee_number": "<staff ihris/employee id>",
  "clock_type": "in|out",
  "clock_time": "2026-09-11T10:15:00+03:00",
  "latitude": 0.34,
  "longitude": 32.58,
  "accuracy": 12.5,
  "location_label": "optional",
  "verification_status": "verified_oos",
  "out_of_station_request_id": 123,
  "entry_id": "pms-clock-uuid-or-entry",
  "source": "performance_system"
}
```

Staff identifier: prefer iHRIS/external employee number from `staff` / HR profile; fallback `staff_id` string. Document in API guide.

**HRM Attend (external):** add route `outoftstation_clockin_post` as a **copy** of `clock_user_post` that persists into the same/sibling table and stores `source=performance_system`. Do not change `clock_user_post`.

## Frontend (Data sources)

- iHRIS: Start / Resume / Cancel + status (poll); remove dependency on browser batch loop for progress continuity.
- HRM inbound: same.
- HRM export: fields for push URL path, basic auth, pull token, Push now, last export status, counts pending.

## Scheduling registration

Extend schedule provider (alongside backups):

- `ihris:sync` → DailyAt `03:00`
- `hrm-attend:sync` → Monthly day 1 `00:15`
- `hrm-attend:export-push` → DailyAt `03:30` (if export_push_enabled)

Document host cron: `* * * * * docker exec moh-pms-api ./moh-pms-api artisan schedule:run`

## Testing

- Unit: export log dedupe; payload mapper; abandoned run resume eligibility.
- Integration: start background sync without HTTP client held open; push skips already-logged clocks.
- Manual: leave Settings mid-sync → status continues; Resume works.

## Out of scope follow-ups

- Exact Attend PHP implementation of `outoftstation_clockin_post`.
- Push of leave/OOS request headers (clocks only in v1).
- Redis-backed queue workers.

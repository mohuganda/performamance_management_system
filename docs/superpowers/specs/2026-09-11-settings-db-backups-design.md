# Settings DB Backups Manager — Design

**Date:** 2026-09-11  
**Status:** Approved for planning (pending user review of this file)  
**Product:** MoH Uganda Performance Management System

## Problem

Admins need a Settings UI to manage database backups: see daily dumps, delete selected files, and restore safely. Dumps must live **outside** the application tree so deploys and container rebuilds do not wipe them. The live OLTP engine may be **Postgres (default)** or **MySQL**; backup/restore must follow the active `DB_CONNECTION`.

## Goals

1. Daily automated logical dumps to a durable host directory (default `/home/moh-pms/db-backups`).
2. Retention: keep **all** dumps for the **current calendar month**; for each **past month**, keep only the **latest** dump of that month.
3. Settings → **Backups** tab: list backups (date, size, engine, status), delete with confirmation, run backup now.
4. Restore flow: **test restore into a throwaway database** → health checks → only then allow **production restore** with explicit confirmation.
5. Dual-engine **capability**: same UX and adapters for Postgres and MySQL; **only the engine configured as primary in env (`DB_CONNECTION`) is dumped and restorable** — never back up both engines in parallel.

## Non-goals

- Point-in-time / WAL continuous archiving (pgBackRest, etc.).
- Backing up Redis, Doris analytics, or media files in this feature (document that media lives under `FILE_STORAGE_ROOT` / `DATA_DIR/media` separately).
- Automatic production restore without admin confirmation.
- Editing dump contents.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Architecture | API-managed dumps + Settings UI; host path mounted into API container |
| Retention | Current month = all dailies; older months = keep one (latest of that month) |
| Restore safety | Test on throwaway DB first; production restore gated on successful recent test |
| Storage root | Outside app/repo; default `/home/moh-pms/db-backups`; override `DB_BACKUP_DIR` |
| Engines | **Only primary** from `DB_CONNECTION` (`postgres` \| `mysql`). Do not dump the inactive engine. Filenames and tools follow that primary. |
| Compression | `.sql.gz` for both engines |

## Storage layout

```text
/home/moh-pms/db-backups/          # host (default)
  moh_pms_postgres_2026-09-11.sql.gz
  moh_pms_mysql_2026-08-31.sql.gz  # historical ok; UI labels engine from filename/metadata
  .restore-state.json              # optional sidecar: last test results per filename
```

- Env: `DB_BACKUP_DIR` (required in prod compose; default path as above).
- Site slug for path: `moh-pms` (fixed product default; not derived from display `APP_NAME`).
- Compose: bind-mount `${DB_BACKUP_DIR}` (or `${DATA_DIR}/../` pattern) into the API container at a fixed in-container path (e.g. `/var/lib/moh-pms/db-backups`) and set `DB_BACKUP_DIR` to that mount inside the container.
- Local/dev: if `/home/moh-pms` is unavailable, allow override to e.g. `$HOME/moh-pms/db-backups` via env; never write under the git workspace by default.

## Engine adapters

Single `BackupService` with a small adapter interface:

| Operation | Postgres | MySQL |
|-----------|----------|--------|
| Dump | `pg_dump` (custom or plain SQL) → gzip | `mysqldump` → gzip |
| Test restore | `CREATE DATABASE moh_pms_restore_test` → `gunzip \| psql` | same pattern with `mysql` client |
| Production restore | drop/recreate or truncate+reload live DB (maintenance) | same |
| Health checks | connect; require core tables (`users`/`staff`/migrations as available); basic counts | same |

- Detect engine **only** from runtime config `DB_CONNECTION` (the primary OLTP). Never invent a second dump for the other engine even if its container is running.
- Daily/manual **Run backup** always targets that primary only.
- Filenames include engine: `moh_pms_{postgres|mysql}_YYYY-MM-DD.sql.gz`.
- Listed files from the other engine (historical leftovers) may appear; **Delete** allowed; **Test/Restore** blocked with a clear message that they are not the current primary.
- API container (or helper via `docker exec`) must have client tools for the **current** primary; document both images so switching `DB_CONNECTION` still works after redeploy.

**Preferred dump transport:** run `pg_dump` / `mysqldump` via `docker exec` into the DB container when `DB_BACKUP_USE_DOCKER_EXEC=true` (prod default), writing the stream to the mounted backup dir on the API/host. Fallback: local client tools using `DB_*` env when not in Docker.

## Retention algorithm

After each successful daily or manual dump:

1. List `*.sql.gz` in `DB_BACKUP_DIR` matching `moh_pms_*_YYYY-MM-DD.sql.gz`.
2. Group by calendar month (`YYYY-MM`).
3. For the **current** month: keep all.
4. For each **past** month: keep the file with the latest date (tie-break: lexicographic name); delete others.
5. Never auto-delete a file that is the only remaining backup for the live engine without logging a warning (still apply month rule; admins can keep manuals by using distinct naming only if we later add tags — **v1: no special “pin”; use Delete manually to remove month keepers**).

## Settings UI

- New tab: **Backups** (`?tab=backups`).
- Permission: `settings.backups.manage` (plus legacy `settings.manage`).
- Panel component: `BackupsAdminPanel.tsx` (Lists-style extraction).
- Show: configured directory (read-only), active engine, last job status.
- Table columns: filename, date, engine, size, last tested (pass/fail/never), actions.
- Actions:
  - **Run backup now**
  - **Delete** → confirm dialog
  - **Test restore** → progress + result message
  - **Restore to production** → disabled until successful test of **that file** within a configurable window (default 24h); require typing `RESTORE` to confirm; warn of downtime

## API surface (admin)

All under auth + `settings.backups.manage`:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/backups` | List files + metadata + test state |
| GET | `/admin/backups/status` | Dir, engine, last scheduled run |
| POST | `/admin/backups/run` | Manual dump + retention |
| DELETE | `/admin/backups/{filename}` | Delete one file (path-safe basename only) |
| POST | `/admin/backups/{filename}/test-restore` | Throwaway restore + checks + record result |
| POST | `/admin/backups/{filename}/restore` | Production restore (gated) |

Path safety: only allow basenames matching `^moh_pms_(postgres|mysql)_\d{4}-\d{2}-\d{2}\.sql\.gz$`; reject `..` and absolute paths.

## Test restore details

1. Acquire a process lock (one restore/test at a time).
2. Create DB `moh_pms_restore_test` (drop if exists).
3. Load dump with the matching client.
4. Checks: can query; migrations/users/staff table presence (best-effort per engine schema); fail if empty critical tables when expected.
5. Drop `moh_pms_restore_test`.
6. Persist result in `.restore-state.json` keyed by filename: `{ tested_at, ok, message, engine }`.

## Production restore details

1. Verify engine match + successful test within window.
2. Confirm token from body (`confirm: "RESTORE"`).
3. Optional: take a fresh “pre-restore” dump into the same dir before applying (recommended, best-effort).
4. Put API in maintenance-friendly mode if available; disconnect pools; restore into live DB name from config.
5. Run migrations if needed (entrypoint pattern); clear test gate for that file after apply.
6. Audit log entry with actor user id, filename, engine.

**Downtime:** expected; UI must state that active users lose sessions/in-flight writes.

## Scheduling

- Goravel schedule (or container cron calling an artisan/HTTP internal job): daily dump + retention (e.g. 02:15 local).
- Idempotent: one dump per calendar day per engine (overwrite same filename or skip if exists — **prefer overwrite same-day file** so “run now” refreshes today).

## Security & audit

- Permission-gated; no public download endpoint in v1 (list metadata only; optional download can be a follow-up).
- Audit every delete, test, restore, manual run.
- Secrets never written into dump filenames; clients use env/Docker secrets.

## Documentation

- Update `docs/DEPLOYMENT.md`: `DB_BACKUP_DIR`, mount, schedule, dual-engine note, restore runbook pointer.
- Short admin note in Settings UI help text.

## Testing

- Unit: retention grouping; filename validation; engine gate.
- Integration (where Docker available): dump → list → test-restore happy path on Postgres; MySQL path smoke if profile enabled.
- Frontend: panel renders list; restore button disabled until test ok.

## Out of scope follow-ups

- Download/export backup via browser.
- Pin/protected backups exempt from retention.
- Media + Redis bundled backup.
- Cross-engine conversion restore (MySQL dump → Postgres).

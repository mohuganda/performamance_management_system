# Settings DB Backups Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings → Backups manager that dumps, lists, deletes, test-restores, and (after a successful test) production-restores **only the primary OLTP** configured by `DB_CONNECTION` (`postgres` or `mysql`), storing files under `/home/moh-pms/db-backups` (overridable).

**Architecture:** `BackupService` adapters for Postgres/MySQL; preferred dump/restore via `docker exec` into `moh-pms-postgres` / `moh-pms-mysql` writing `.sql.gz` into a host directory mounted into the API. Admin REST under `/admin/backups/*`; Settings tab `BackupsAdminPanel`. Daily job via artisan command + schedule/cron. Retention keeps all current-month dumps and one latest dump per past month.

**Tech Stack:** Goravel/Go, Postgres 16 / MySQL 8.4, React Settings UI, Docker Compose mounts, gzip SQL dumps.

**Spec:** `docs/superpowers/specs/2026-09-11-settings-db-backups-design.md`

## Global Constraints

- Backup **only** the engine in env `DB_CONNECTION` (primary). Never dump the inactive engine in parallel.
- Storage outside app/repo; default host path `/home/moh-pms/db-backups`; env `DB_BACKUP_DIR`.
- Filenames: `moh_pms_{postgres|mysql}_YYYY-MM-DD.sql.gz`
- Retention: all files for current calendar month; past months keep only the latest dated file.
- Restore: test into throwaway DB `moh_pms_restore_test` first; production restore requires successful test within 24h + body `confirm: "RESTORE"`.
- Path safety: basename-only; regex `^moh_pms_(postgres|mysql)_\d{4}-\d{2}-\d{2}\.sql\.gz$`
- Cross-engine file vs live primary: delete OK; test/restore blocked.
- Permission: `settings.backups.manage` (+ legacy `settings.manage`).
- Do not commit unless the user explicitly asks (or plan commit steps during execution when user chose full plan execution with commits).

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/app/services/backup_retention.go` | Pure retention + filename parse helpers |
| `backend/app/services/backup_retention_test.go` | Unit tests for retention/filename |
| `backend/app/services/backup_service.go` | List, dump, delete, test-restore, restore, status, locks |
| `backend/app/services/backup_exec.go` | Docker-exec / local client dump & restore runners |
| `backend/app/http/controllers/backup_admin_controller.go` | Admin HTTP handlers |
| `backend/app/console/commands/backup_database.go` | Artisan `backup:database` |
| `backend/app/console/kernel.go` (or schedule registration in bootstrap) | Daily schedule 02:15 |
| `backend/database/migrations/20260911000004_settings_backups_permission.go` | Permission + grant admin |
| `backend/bootstrap/migrations.go` | Register migration |
| `backend/routes/api.go` | Wire `/admin/backups/*` |
| `deploy/env.deploy.example` + `deploy/docker-compose.prod.yml` | `DB_BACKUP_DIR` + volume mount |
| `docs/DEPLOYMENT.md` | Runbook |
| `frontend/src/constants/settingsPermissions.ts` | Tab + permission |
| `frontend/src/api/services/backupsAdmin.ts` | API client |
| `frontend/src/modules/settings/BackupsAdminPanel.tsx` | UI |
| `frontend/src/modules/settings/SettingsPage.tsx` | Tab wiring |

---

### Task 1: Retention helpers + filename validation (TDD)

**Files:**
- Create: `backend/app/services/backup_retention.go`
- Create: `backend/app/services/backup_retention_test.go`

**Interfaces:**
- Produces:

```go
const BackupFilenamePattern = `^moh_pms_(postgres|mysql)_(\d{4}-\d{2}-\d{2})\.sql\.gz$`

type ParsedBackupName struct {
  Filename string
  Engine   string // postgres | mysql
  Date     time.Time // date only UTC
}

func ParseBackupFilename(name string) (ParsedBackupName, error)
func ValidateBackupBasename(name string) error // rejects path separators / ..
func ApplyRetention(files []ParsedBackupName, now time.Time) (keep []string, drop []string)
func BuildBackupFilename(engine string, day time.Time) string
```

- [ ] **Step 1: Failing tests**

```go
func TestParseBackupFilename(t *testing.T) {
  p, err := ParseBackupFilename("moh_pms_postgres_2026-09-11.sql.gz")
  if err != nil || p.Engine != "postgres" {
    t.Fatal(err, p)
  }
  if _, err := ParseBackupFilename("../etc/passwd"); err == nil {
    t.Fatal("expected error")
  }
}

func TestApplyRetention(t *testing.T) {
  now := time.Date(2026, 9, 15, 12, 0, 0, 0, time.UTC)
  // Sept 1,2,15 keep all; Aug 10 and Aug 31 → keep only Aug 31; Jul 1 only → keep
  files := []ParsedBackupName{ /* build with ParseBackupFilename */ }
  keep, drop := ApplyRetention(files, now)
  // assert Aug 10 in drop, Aug 31 in keep, all Sept in keep
}
```

- [ ] **Step 2: Run — expect FAIL**

`cd backend && go test ./app/services -run 'TestParseBackupFilename|TestApplyRetention' -count=1`

- [ ] **Step 3: Implement helpers** in `backup_retention.go` (stdlib `regexp`, `time`, `path/filepath.Base`).

- [ ] **Step 4: Run — expect PASS**

`cd backend && go test ./app/services -run 'TestParseBackupFilename|TestApplyRetention' -count=1`

---

### Task 2: BackupService — list / dump / delete / retention

**Files:**
- Create: `backend/app/services/backup_exec.go`
- Create: `backend/app/services/backup_service.go`
- Modify: `deploy/env.deploy.example` — add `DB_BACKUP_DIR`, `DB_BACKUP_USE_DOCKER_EXEC`
- Modify: `deploy/docker-compose.prod.yml` — mount backups into API

**Interfaces:**
- Produces:

```go
type BackupFileInfo struct {
  Filename   string `json:"filename"`
  Engine     string `json:"engine"`
  Date       string `json:"date"` // YYYY-MM-DD
  SizeBytes  int64  `json:"size_bytes"`
  TestedAt   string `json:"tested_at,omitempty"`
  TestOK     *bool  `json:"test_ok,omitempty"`
  TestMessage string `json:"test_message,omitempty"`
  CanRestore bool   `json:"can_restore"` // primary engine + successful test within 24h
}

type BackupStatus struct {
  Directory       string `json:"directory"`
  PrimaryEngine   string `json:"primary_engine"` // from DB_CONNECTION
  DockerExec      bool   `json:"docker_exec"`
  LastRunAt       string `json:"last_run_at,omitempty"`
  LastRunMessage  string `json:"last_run_message,omitempty"`
}

func (s *BackupService) PrimaryEngine() string // postgres|mysql from config
func (s *BackupService) Status() (BackupStatus, error)
func (s *BackupService) List() ([]BackupFileInfo, error)
func (s *BackupService) RunBackup() (BackupFileInfo, error) // dump primary only + ApplyRetention deletes
func (s *BackupService) Delete(filename string) error
```

- Consumes: Task 1 helpers; `config.Env("DB_BACKUP_DIR")` default `/var/lib/moh-pms/db-backups` in-container (host `/home/moh-pms/db-backups`); `DB_BACKUP_USE_DOCKER_EXEC` default true in prod.

**Dump behavior:**
- Engine from `facades.Config().GetString("database.default")` or env `DB_CONNECTION` — **only that engine**.
- Prefer: `docker exec moh-pms-postgres pg_dump -U … db | gzip > $DIR/file` (or mysql equivalent).
- Same-day filename overwritten.
- After dump, call retention and delete dropped files from disk.
- Persist last-run in `$DIR/.backup-status.json`.

- [ ] **Step 1: Implement `backup_exec.go`** with `DumpPrimaryToFile(path string) error` and env-driven docker vs local.

- [ ] **Step 2: Implement `BackupService` List/RunBackup/Delete/Status** + `.restore-state.json` read for list enrichment (write comes in Task 3).

- [ ] **Step 3: Wire compose**

```yaml
# API service volumes (concept):
- ${DB_BACKUP_DIR:-/home/moh-pms/db-backups}:/var/lib/moh-pms/db-backups
# env:
DB_BACKUP_DIR: /var/lib/moh-pms/db-backups
DB_BACKUP_USE_DOCKER_EXEC: "true"
```

Host default in `env.deploy.example`: `DB_BACKUP_DIR=/home/moh-pms/db-backups`.

- [ ] **Step 4: Verify**

`cd backend && go build -o /dev/null .`

Manual (when containers up): create dir, `RunBackup`, confirm file named with primary engine only.

---

### Task 3: Test restore + production restore

**Files:**
- Modify: `backend/app/services/backup_service.go`
- Modify: `backend/app/services/backup_exec.go`

**Interfaces:**
- Produces:

```go
func (s *BackupService) TestRestore(filename string) (BackupFileInfo, error)
func (s *BackupService) RestoreProduction(filename string, confirm string) error // confirm must be "RESTORE"
```

**TestRestore:**
1. Global file lock under `$DIR/.backup.lock`.
2. `ValidateBackupBasename` + parse; engine must equal `PrimaryEngine()`.
3. Create/drop DB `moh_pms_restore_test`; load dump; run checks (`SELECT 1`, and existence of at least one of `users`/`staff` if present).
4. Drop test DB; write `.restore-state.json` entry; return info with `CanRestore` true if ok.

**RestoreProduction:**
1. `confirm == "RESTORE"`.
2. Require matching engine + `TestOK` and `TestedAt` within 24h.
3. Best-effort pre-restore dump (`RunBackup` or dated `-prerestore` skip if too heavy — **v1: call RunBackup first**).
4. Restore into live database name from config (destructive); clear can_restore for that file after success.
5. Call `AuditService.Log` with module `backups`, dangerous true.

- [ ] **Step 1: Implement TestRestore + RestoreProduction**

- [ ] **Step 2: Unit-test gate logic** (confirm string, engine mismatch, stale test) in `backup_restore_gate_test.go` without Docker if extracted as pure functions:

```go
func CanProductionRestore(primaryEngine string, info BackupFileInfo, now time.Time, window time.Duration) error
func RequireRestoreConfirm(confirm string) error
```

- [ ] **Step 3: `go test` + `go build`**

---

### Task 4: Admin API + permission + artisan + schedule

**Files:**
- Create: `backend/app/http/controllers/backup_admin_controller.go`
- Create: `backend/database/migrations/20260911000004_settings_backups_permission.go`
- Modify: `backend/bootstrap/migrations.go`
- Modify: `backend/routes/api.go`
- Create: `backend/app/console/commands/backup_database.go` (+ register command like other Goravel commands if present; else document `go run . artisan`-style entry)
- Schedule: register daily `backup:database` at 02:15 **or** document host cron:  
  `15 2 * * * docker exec moh-pms-api /usr/bin/… backup`  
  Prefer an HTTP-free artisan command invoked by cron if schedule kernel is missing.

**Routes:**

```go
auth.Prefix("admin/backups").Middleware(middleware.Permission("settings.manage", "settings.backups.manage")).Group(func(b route.Router) {
  b.Get("/", ctrl.List)
  b.Get("/status", ctrl.Status)
  b.Post("/run", ctrl.Run)
  b.Delete("/{filename}", ctrl.Delete)
  b.Post("/{filename}/test-restore", ctrl.TestRestore)
  b.Post("/{filename}/restore", ctrl.Restore) // body: { "confirm": "RESTORE" }
})
```

- [ ] **Step 1: Migration** seeding `settings.backups.manage` and `GrantPermission("admin", …)` (same pattern as `20260721000001_settings_tab_permissions.go`).

- [ ] **Step 2: Controller + routes**

- [ ] **Step 3: Artisan command** calling `NewBackupService().RunBackup()`

- [ ] **Step 4: Verify** `go build -o /dev/null .`

---

### Task 5: Settings UI — Backups tab

**Files:**
- Modify: `frontend/src/constants/settingsPermissions.ts` — add `backups` tab + `settings.backups.manage`
- Create: `frontend/src/api/services/backupsAdmin.ts`
- Create: `frontend/src/modules/settings/BackupsAdminPanel.tsx`
- Modify: `frontend/src/modules/settings/SettingsPage.tsx` — tab + `canBackups` + render panel
- Modify: `docs/DEPLOYMENT.md` — `DB_BACKUP_DIR`, cron, dual-engine primary-only note

**UI requirements:**
- Show directory + primary engine from `/admin/backups/status`.
- Table of backups; **Run backup now**; **Delete** confirm; **Test restore**; **Restore to production** disabled unless `can_restore`; confirm modal requiring typing `RESTORE`.
- Help text: only the primary DB from env is backed up; files for other engines are historical and not restorable while that engine is inactive.

- [ ] **Step 1: API client + permissions**

- [ ] **Step 2: `BackupsAdminPanel`** using existing Card/Button/table patterns (mirror ListsAdminPanel density; MoH green actions).

- [ ] **Step 3: Wire SettingsPage tab `backups`**

- [ ] **Step 4: Frontend typecheck**

`cd frontend && npx tsc --noEmit -p tsconfig.json`

- [ ] **Step 5: DEPLOYMENT.md** section “Database backups”

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Primary-only `DB_CONNECTION` | 2, 5 |
| `/home/moh-pms/db-backups` + env | 2, 5 |
| Daily dump + retention A | 1, 2, 4 |
| List / delete / run | 2, 4, 5 |
| Test then production restore | 3, 4, 5 |
| Dual adapters, cross-engine block | 2, 3 |
| Permission + Settings tab | 4, 5 |
| Audit on dangerous ops | 3 |
| Docs | 5 |

## Placeholder / consistency review

- No TBD left; engine always from primary env.
- Filename regex shared Task 1 → all later tasks.
- `CanRestore` computed server-side for UI disablement.

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-11-settings-db-backups.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh agent per task, review between tasks  
2. **Inline Execution** — implement in this session with checkpoints  

Which approach?

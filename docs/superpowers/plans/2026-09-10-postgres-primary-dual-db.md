# Postgres Primary Dual-DB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PostgreSQL the default primary OLTP database while keeping MySQL fully selectable at setup, and migrate this project's current MySQL data to Postgres with an offline one-shot tool.

**Architecture:** Goravel already registers mysql and postgres drivers; switch via `DB_CONNECTION`. Compose defines both DB services but starts only the chosen engine (`--profile app --profile postgres|mysql`). Setup writes `DB_*` + prompts/`--db`. Raw MySQL-only migrations become dialect-aware. Cutover uses dump + schema migrate + `pgloader` (Docker image) then flips env.

**Tech Stack:** Goravel (Go), Docker Compose v2, MySQL 8.4, PostgreSQL 16, `dimitri/pgloader` for cutover, bash setup scripts.

**Spec:** `docs/superpowers/specs/2026-09-10-postgres-primary-dual-db-design.md`

## Global Constraints

- Postgres is the default for new installs (`DB_CONNECTION=postgres`, port `5432`).
- MySQL remains a first-class option (`DB_CONNECTION=mysql`).
- Only the chosen DB service runs in normal operation.
- Doris / `ANALYTICS_DB_*` stays on MySQL protocol; do not change its driver.
- Offline one-shot cutover only; keep MySQL volume until verified.
- Prefer small, focused diffs; do not rewrite the entire schema for Postgres idioms.

## File map

| File | Responsibility |
|------|----------------|
| `backend/app/support/dbdialect/dialect.go` | Detect `mysql` vs `postgres` for migration SQL |
| `backend/database/migrations/20260901000001_*.go` | Dialect-safe profile photo column alters |
| `backend/database/migrations/20260901000002_*.go` | Dialect-safe path column alters |
| `backend/database/migrations/20260722000001_leave_workflow.go` | Dialect-safe unique index rebuild |
| `backend/database/migrations/20260719000001_geography_hierarchy.go` | Portable district↔region UPDATE |
| `backend/database/migrations/20260711000001_add_kpi_subject_area.go` | Skip `.After()` on Postgres |
| `backend/config/database.go` | Default `DB_CONNECTION` to `postgres` |
| `deploy/docker-compose.prod.yml` | Add `postgres` service; profile-gate DBs; env-driven backend `DB_*` |
| `docker-compose.yml` | Same dual-DB pattern for local/root compose |
| `backend/scripts/docker-entrypoint.sh` | Honor `DB_CONNECTION`; stop hardcoding mysql |
| `backend/scripts/docker-dev-entrypoint.sh` | Same |
| `deploy/env.deploy.example` | Postgres defaults + DB choice docs |
| `backend/.env.example` | Postgres defaults |
| `setup.sh` | Prompt / `--db`; write `DB_*`; compose profiles |
| `scripts/dev.sh` | Start chosen DB (default postgres) |
| `scripts/migrate-mysql-to-postgres.sh` | Offline cutover wrapper |
| `docs/DEPLOYMENT.md` / `README.md` | Ops docs, `pg_dump`, cutover |

---

### Task 1: Dialect helper + Postgres default in config

**Files:**
- Create: `backend/app/support/dbdialect/dialect.go`
- Create: `backend/app/support/dbdialect/dialect_test.go`
- Modify: `backend/config/database.go`

**Interfaces:**
- Produces: `dbdialect.Name() string` → `"mysql"` | `"postgres"` (normalized); `dbdialect.IsPostgres() bool`; `dbdialect.IsMysql() bool`

- [ ] **Step 1: Write failing unit tests**

```go
package dbdialect

import "testing"

func TestNormalize(t *testing.T) {
	if got := normalize("POSTGRES"); got != "postgres" {
		t.Fatalf("got %q", got)
	}
	if got := normalize("MySQL"); got != "mysql" {
		t.Fatalf("got %q", got)
	}
	if got := normalize(""); got != "postgres" {
		t.Fatalf("empty should default postgres, got %q", got)
	}
}
```

- [ ] **Step 2: Run test — expect FAIL (package missing)**

Run: `cd backend && go test ./app/support/dbdialect/ -v`
Expected: FAIL cannot find package / no such directory

- [ ] **Step 3: Implement helper**

```go
package dbdialect

import (
	"strings"

	"goravel/app/facades"
)

func normalize(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "mysql":
		return "mysql"
	case "postgres", "postgresql", "pgsql":
		return "postgres"
	case "":
		return "postgres"
	default:
		return strings.ToLower(strings.TrimSpace(raw))
	}
}

// Name returns the active OLTP driver name (mysql|postgres).
func Name() string {
	return normalize(facades.Config().GetString("database.default"))
}

func IsPostgres() bool { return Name() == "postgres" }
func IsMysql() bool    { return Name() == "mysql" }
```

Export `normalize` only via tests in same package (keep unexported) — tests call `normalize` directly as above.

- [ ] **Step 4: Default DB_CONNECTION to postgres in config**

In `backend/config/database.go`, change:

```go
"default": config.Env("DB_CONNECTION", "postgres"),
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `cd backend && go test ./app/support/dbdialect/ -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/support/dbdialect backend/config/database.go
git commit -m "Add db dialect helper and default DB_CONNECTION to postgres."
```

---

### Task 2: Make profile-asset migrations dialect-safe

**Files:**
- Modify: `backend/database/migrations/20260901000001_profile_assets_longtext.go`
- Modify: `backend/database/migrations/20260901000002_profile_photo_path_column.go`

**Interfaces:**
- Consumes: `dbdialect.IsPostgres()`, `dbdialect.IsMysql()`

- [ ] **Step 1: Update `20260901000001` Up/Down**

On MySQL keep `MODIFY … LONGTEXT`. On Postgres: columns are already `text` from prior migrations — no-op (return nil) or `ALTER COLUMN … TYPE text` if needed:

```go
func (r *M20260901000001ProfileAssetsLongtext) Up() error {
	if dbdialect.IsPostgres() {
		// TEXT already unbounded; nothing to widen.
		return nil
	}
	_, err := facades.Orm().Query().Exec(
		"ALTER TABLE users MODIFY profile_photo LONGTEXT NULL, MODIFY signature_image LONGTEXT NULL",
	)
	return err
}
```

Mirror Down: MySQL `MODIFY … TEXT`; Postgres no-op.

- [ ] **Step 2: Update `20260901000002`**

Keep portable `UPDATE … SET … WHERE … LIKE 'data:%'` (valid on both).

Column resize:
- MySQL: existing `MODIFY … VARCHAR(512)`
- Postgres:

```sql
ALTER TABLE users
  ALTER COLUMN profile_photo TYPE VARCHAR(512) USING LEFT(profile_photo, 512),
  ALTER COLUMN signature_image TYPE VARCHAR(512) USING LEFT(signature_image, 512);
```

Down reverses with dialect branches (MySQL LONGTEXT; Postgres `TYPE text`).

- [ ] **Step 3: Compile migrations package**

Run: `cd backend && go build ./database/migrations/`
Expected: success

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/20260901000001_profile_assets_longtext.go backend/database/migrations/20260901000002_profile_photo_path_column.go
git commit -m "Make profile asset migrations work on MySQL and Postgres."
```

---

### Task 3: Fix leave workflow index + geography UPDATE + KPI `.After`

**Files:**
- Modify: `backend/database/migrations/20260722000001_leave_workflow.go` (`rebuildStageUniqueIndex`)
- Modify: `backend/database/migrations/20260719000001_geography_hierarchy.go`
- Modify: `backend/database/migrations/20260711000001_add_kpi_subject_area.go`

**Interfaces:**
- Consumes: `dbdialect.IsPostgres()`, `dbdialect.IsMysql()`

- [ ] **Step 1: Dialect-aware `rebuildStageUniqueIndex`**

```go
func (r *M20260722000001LeaveWorkflow) rebuildStageUniqueIndex() error {
	if !facades.Schema().HasTable("leave_approval_stages") {
		return nil
	}
	if dbdialect.IsPostgres() {
		drops := []string{
			`ALTER TABLE leave_approval_stages DROP CONSTRAINT IF EXISTS leave_approval_stages_code_unique`,
			`DROP INDEX IF EXISTS leave_approval_stages_code_unique`,
			`DROP INDEX IF EXISTS leave_approval_stages_code_index`,
			`DROP INDEX IF EXISTS idx_leave_stage_profile_code`,
		}
		for _, stmt := range drops {
			_, _ = facades.Orm().Query().Exec(stmt)
		}
		_, err := facades.Orm().Query().Exec(
			`CREATE UNIQUE INDEX IF NOT EXISTS idx_leave_stage_profile_code ON leave_approval_stages (workflow_profile_code, code)`,
		)
		if err != nil {
			return err
		}
	} else {
		// existing MySQL DROP INDEX / ADD UNIQUE INDEX block
	}
	// existing Update workflow_profile_code default…
	return nil
}
```

- [ ] **Step 2: Portable geography UPDATE**

Replace MySQL join-update with:

```sql
UPDATE districts d
SET region_id = r.id
FROM regions r
WHERE UPPER(TRIM(d.region)) = UPPER(TRIM(r.name))
  AND (d.region_id IS NULL OR d.region_id = 0)
```

For MySQL keep the original `UPDATE … JOIN … SET` in an `if dbdialect.IsMysql()` branch; use the `FROM` form for Postgres.

Also: `INSERT … SELECT … WHERE NOT EXISTS` with `NOW()` is fine on both; boolean `1` for `is_active` — if Postgres boolean rejects `1`, use `true` on Postgres / `1` on MySQL (branch that literal).

- [ ] **Step 3: KPI subject_area `.After`**

```go
col := table.UnsignedTinyInteger("subject_area").Nullable()
if dbdialect.IsMysql() {
	col.After("computation_category")
}
```

(Adjust to match actual Blueprint API — if `After` returns the column builder, chain only on MySQL.)

- [ ] **Step 4: Build**

Run: `cd backend && go build ./database/migrations/`
Expected: success

- [ ] **Step 5: Commit**

```bash
git add backend/database/migrations/20260722000001_leave_workflow.go backend/database/migrations/20260719000001_geography_hierarchy.go backend/database/migrations/20260711000001_add_kpi_subject_area.go
git commit -m "Make leave, geography, and KPI migrations dialect-safe."
```

---

### Task 4: Prod compose — Postgres service + profile gating

**Files:**
- Modify: `deploy/docker-compose.prod.yml`

**Interfaces:**
- Produces: services `postgres` (profile `postgres`) and `mysql` (profile `mysql`); shared services stay on profile `app`. Backend `DB_*` from env. `depends_on` uses `required: false` for both DBs.

- [ ] **Step 1: Add postgres service**

```yaml
  postgres:
    image: postgres:16-alpine
    container_name: moh-pms-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_DATABASE:-moh_pms}
      POSTGRES_USER: ${DB_USERNAME:-pms}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - ${DATA_DIR}/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USERNAME:-pms} -d ${DB_DATABASE:-moh_pms}"]
      interval: 10s
      timeout: 5s
      retries: 18
      start_period: 60s
    profiles:
      - postgres
```

- [ ] **Step 2: Change mysql profiles from `app` to `mysql` only**

```yaml
    profiles:
      - mysql
```

Keep legacy SQL bind-mount on MySQL only.

- [ ] **Step 3: Backend DB env from deploy `.env`**

Replace hardcoded mysql block with:

```yaml
      DB_CONNECTION: ${DB_CONNECTION:-postgres}
      DB_HOST: ${DB_HOST:-postgres}
      DB_PORT: ${DB_PORT:-5432}
      DB_DATABASE: ${DB_DATABASE:-moh_pms}
      DB_USERNAME: ${DB_USERNAME:-pms}
      DB_PASSWORD: ${DB_PASSWORD}
      DB_SCHEMA: ${DB_SCHEMA:-public}
```

- [ ] **Step 4: Backend depends_on both DBs as optional**

```yaml
    depends_on:
      mysql:
        condition: service_healthy
        required: false
      postgres:
        condition: service_healthy
        required: false
      redis:
        condition: service_healthy
```

Requires Docker Compose v2.20+ (`required: false`). If the host compose is older, document minimum version in DEPLOYMENT.

- [ ] **Step 5: Validate compose file**

Run: `docker compose -f deploy/docker-compose.prod.yml --env-file deploy/env.deploy.example config >/dev/null`
Expected: exit 0 (may need temporary DB_PASSWORD in env file for interpolation)

- [ ] **Step 6: Commit**

```bash
git add deploy/docker-compose.prod.yml
git commit -m "Add Postgres service and profile-gate OLTP engines in prod compose."
```

---

### Task 5: Root compose + entrypoints + env examples

**Files:**
- Modify: `docker-compose.yml`
- Modify: `backend/scripts/docker-entrypoint.sh`
- Modify: `backend/scripts/docker-dev-entrypoint.sh`
- Modify: `deploy/env.deploy.example`
- Modify: `backend/.env.example`

- [ ] **Step 1: Mirror dual-DB pattern in root `docker-compose.yml`**

Default env for backend:

```yaml
DB_CONNECTION: postgres
DB_HOST: postgres
DB_PORT: 5432
DB_DATABASE: moh_pms
DB_USERNAME: pms
DB_PASSWORD: pms_secret
```

Add `postgres` service (port `5433:5432` on host to avoid clashes). Keep `mysql` available but do not start it by default — use profiles `postgres` / `mysql` and document:

```bash
docker compose --profile postgres up -d
# or
docker compose --profile mysql up -d
```

If current root compose has no profiles, introduce them consistently with prod (`app` optional for root — root can start redis+backend+frontend without the `app` profile name; prefer: postgres/mysql profiles for DB only, other services always on).

Simplest root approach matching prod:
- DB services: profiles `postgres` | `mysql`
- Other services: no profile (always start) **or** keep as today and require `--profile postgres`.

Choose: **DB services profile-gated; redis/backend/frontend always defined; document `docker compose --profile postgres up -d`.**

- [ ] **Step 2: Entrypoint — stop hardcoding mysql**

In both entrypoint scripts, replace:

```sh
DB_CONNECTION=mysql
DB_HOST=$(env_quote "${DB_HOST:-mysql}")
DB_PORT=$(env_quote "${DB_PORT:-3306}")
```

with:

```sh
DB_CONNECTION=$(env_quote "${DB_CONNECTION:-postgres}")
DB_HOST=$(env_quote "${DB_HOST:-postgres}")
DB_PORT=$(env_quote "${DB_PORT:-5432}")
DB_SCHEMA=$(env_quote "${DB_SCHEMA:-public}")
```

Include `DB_SCHEMA=…` line in generated `.env`.

- [ ] **Step 3: Update env examples**

`deploy/env.deploy.example`:

```bash
# Primary OLTP: postgres (default) or mysql
DB_CONNECTION=postgres
DB_HOST=postgres
DB_PORT=5432
DB_DATABASE=moh_pms
DB_USERNAME=pms
DB_PASSWORD=change_me_pms
DB_SCHEMA=public

# Used when DB_CONNECTION=mysql (compose mysql service)
MYSQL_ROOT_PASSWORD=change_me_root
MYSQL_DATABASE=moh_pms
MYSQL_USER=pms
MYSQL_PASSWORD=change_me_pms

EXPOSE_POSTGRES=false
EXPOSE_MYSQL=false
POSTGRES_HOST_PORT=5433
MYSQL_HOST_PORT=3307
```

`backend/.env.example`: set `DB_CONNECTION=postgres`, comment ports, update Doris comment to “fallback to primary OLTP”.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml backend/scripts/docker-entrypoint.sh backend/scripts/docker-dev-entrypoint.sh deploy/env.deploy.example backend/.env.example
git commit -m "Default Docker and env templates to Postgres; keep MySQL selectable."
```

---

### Task 6: `setup.sh` — choose DB (prompt + `--db`)

**Files:**
- Modify: `setup.sh`
- Modify: `scripts/dev.sh` (if it hardcodes `mysql`)

**Interfaces:**
- Produces: `DB_CONNECTION` in `deploy/.env`; `compose()` adds `--profile "${DB_CONNECTION}"`; `write_override` supports `EXPOSE_POSTGRES`.

- [ ] **Step 1: Add variables and CLI flag**

Near top defaults:

```bash
DB_CONNECTION="postgres"
CLI_DB_CONNECTION=""
DB_PASSWORD=""   # unified app password (reuse MYSQL_PASSWORD migration path)
```

Parse `--db postgres|mysql` into `CLI_DB_CONNECTION`.

- [ ] **Step 2: Resolve DB before writing env**

```bash
resolve_db_connection() {
  if [[ -n "${CLI_DB_CONNECTION}" ]]; then
    DB_CONNECTION="${CLI_DB_CONNECTION}"
    return
  fi
  if [[ -f "${ENV_FILE}" ]]; then
    # shellcheck source=/dev/null
    source "${ENV_FILE}"
    if [[ -n "${DB_CONNECTION:-}" ]]; then
      return
    fi
  fi
  if [[ -t 0 ]]; then
    echo "Primary database?"
    echo "  1) PostgreSQL (default)"
    echo "  2) MySQL"
    read -r -p "Choice [1/2]: " choice
    case "${choice}" in
      2|mysql|MYSQL) DB_CONNECTION="mysql" ;;
      *) DB_CONNECTION="postgres" ;;
    esac
  else
    DB_CONNECTION="postgres"
  fi
}
```

Normalize to exactly `postgres` or `mysql`; exit 1 on invalid `--db`.

- [ ] **Step 3: `write_env_file` emits `DB_*`**

When `postgres`:

```bash
DB_CONNECTION=postgres
DB_HOST=postgres
DB_PORT=5432
DB_DATABASE=moh_pms
DB_USERNAME=pms
DB_PASSWORD=...
DB_SCHEMA=public
```

When `mysql`:

```bash
DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=moh_pms
DB_USERNAME=pms
DB_PASSWORD=...
# plus MYSQL_* for the mysql image
```

Keep generating `MYSQL_*` always (harmless) or only in mysql mode — prefer always for simpler compose healthcheck substitution when profile unused.

- [ ] **Step 4: Update `compose()`**

```bash
docker compose --env-file "${ENV_FILE}" "${files[@]}" --profile app --profile "${DB_CONNECTION}" "$@"
```

Ensure `DB_CONNECTION` is loaded from env file before compose calls (source env or export).

- [ ] **Step 5: `ensure_data_dirs` creates `postgres` dir; help/logs mention both**

```bash
mkdir -p "${DATA_DIR}/postgres" "${DATA_DIR}/mysql" ...
```

- [ ] **Step 6: `write_override` for expose ports**

Support `EXPOSE_POSTGRES` → publish `${POSTGRES_HOST_PORT}:5432`.

- [ ] **Step 7: Update `scripts/dev.sh`**

Replace `up -d mysql redis` with profile-aware postgres default.

- [ ] **Step 8: Dry-run help**

Run: `./setup.sh --help | head`
Expected: shows `--db postgres|mysql`

- [ ] **Step 9: Commit**

```bash
git add setup.sh scripts/dev.sh
git commit -m "Let setup choose Postgres or MySQL via prompt and --db."
```

---

### Task 7: Offline MySQL→Postgres cutover script

**Files:**
- Create: `scripts/migrate-mysql-to-postgres.sh`
- Modify: `docs/DEPLOYMENT.md` (cutover section)

**Interfaces:**
- Consumes: running/accessible MySQL with app data; empty or `--force` Postgres
- Produces: Postgres loaded + printed next steps to flip `DB_CONNECTION`

- [ ] **Step 1: Write script skeleton with safety checks**

Script must:

1. Require `deploy/.env` or flags for MySQL + Postgres credentials.
2. Refuse if `pgloader` Docker pull/run fails.
3. Stop backend (compose stop backend frontend gateway) while leaving MySQL up.
4. Start postgres profile alongside mysql for cutover only.
5. Wait for both healthy.
6. Run migrations inside backend container **against Postgres** (temporarily set env) OR run a one-off migrate container.
7. Run `pgloader` from MySQL → Postgres (exclude `migrations` table from data copy if schema already applied — load data only for app tables; simplest: let pgloader create+load then re-run migrate carefully — **preferred:** migrate schema first on empty Postgres, then pgloader with `including only table names matching …` / `DATA ONLY` if supported).

Minimal reliable flow using Docker:

```bash
# After empty Postgres is migrated by API entrypoint pointed at postgres:
docker run --rm --network <compose_network> dimitri/pgloader:latest \
  pgloader \
  "mysql://USER:PASS@mysql:3306/moh_pms" \
  "postgresql://USER:PASS@postgres:5432/moh_pms"
```

Then reset sequences:

```sql
SELECT setval(pg_get_serial_sequence(quote_ident(tablename), 'id'), coalesce(max(id),1))
FROM ... -- per table with serial id
```

Provide a small SQL file `scripts/sql/postgres_reset_sequences.sql` generated or a bash loop via `psql`.

8. Row-count compare for key tables: `users`, `staff_hr_profiles`, `leave_requests`, `system_configs`.
9. Print: set `DB_CONNECTION=postgres`, restart with `--profile postgres` only, keep MySQL volume.

Flags: `--force`, `--dry-run` (print commands only).

- [ ] **Step 2: Document in DEPLOYMENT.md**

Sections: prerequisites, downtime expectation, command, verification, rollback (`DB_CONNECTION=mysql`, `--profile mysql`).

- [ ] **Step 3: Make executable and syntax-check**

Run: `bash -n scripts/migrate-mysql-to-postgres.sh`
Expected: no output, exit 0

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-mysql-to-postgres.sh scripts/sql/postgres_reset_sequences.sql docs/DEPLOYMENT.md
git commit -m "Add offline MySQL to Postgres cutover script and docs."
```

---

### Task 8: Docs polish + wording (Doris fallback)

**Files:**
- Modify: `README.md` (DB section)
- Modify: `backend/.env.example` Doris comments (if not done)
- Modify: any “fallback to MySQL” user-facing strings in `dashboard_analytics_service.go` → `"primary"` / `"oltp"` label only if present

- [ ] **Step 1: README — primary DB is Postgres; MySQL optional via `--db mysql`**
- [ ] **Step 2: Backup examples — `pg_dump` first; `mysqldump` under MySQL mode**
- [ ] **Step 3: Commit**

```bash
git add README.md docs/DEPLOYMENT.md backend/app/services/dashboard_analytics_service.go
git commit -m "Document Postgres as default OLTP and optional MySQL installs."
```

---

### Task 9: Verify migrate on clean Postgres (and MySQL smoke)

**Files:** none new (verification task)

- [ ] **Step 1: Clean Postgres migrate**

```bash
cd /Users/user/Documents/performamance_management_system
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env --profile app --profile postgres up -d postgres redis
# point a one-off backend or use existing stack with DB_CONNECTION=postgres
docker compose ... --profile app --profile postgres up -d --build backend
docker logs moh-pms-api 2>&1 | tail -50
```

Expected: `[entrypoint] Running migrations...` succeeds; healthcheck green.

- [ ] **Step 2: Login smoke**

Open app URL / hit `POST /api/v1/auth/login` with admin credentials from `.env`.

Expected: 200 + token.

- [ ] **Step 3: Optional MySQL regression**

Same with `--profile mysql` and `DB_CONNECTION=mysql` on a disposable volume.

- [ ] **Step 4: Commit only if fixes required** (empty commit not needed)

---

### Task 10: Cut over this project to Postgres

**Files:**
- Modify: `deploy/.env` (local, not committed)

- [ ] **Step 1: Backup MySQL data dir / dump**

```bash
# example
docker exec moh-pms-mysql mysqldump -upms -p"$MYSQL_PASSWORD" moh_pms > /tmp/moh_pms_mysql_backup.sql
```

- [ ] **Step 2: Run cutover script**

```bash
./scripts/migrate-mysql-to-postgres.sh
```

Expected: row-count summary printed; exit 0.

- [ ] **Step 3: Flip env and restart Postgres-only**

Ensure `deploy/.env` has `DB_CONNECTION=postgres`, `DB_HOST=postgres`, `DB_PORT=5432`. Restart:

```bash
./setup.sh --db postgres --restart
# or compose down + up with profiles app+postgres only
```

- [ ] **Step 4: Verify login + one data page (approvals / staff list)**

- [ ] **Step 5: Leave MySQL volume in place; do not delete until operator confirms**

- [ ] **Step 6: No git commit for local `.env`; commit any script fixes discovered during cutover**

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Postgres default | 1, 5, 6 |
| MySQL still supported | 4, 5, 6, 9 |
| Prompt + `--db` + env | 6 |
| Only chosen engine starts | 4, 6 |
| Dialect-safe migrations | 2, 3 |
| Offline cutover tool | 7, 10 |
| Migrate this project | 10 |
| Doris unchanged | Global constraint; Task 8 wording only |
| Docs / backups | 7, 8 |

## Placeholder / consistency review

- Driver name normalized to `postgres` | `mysql` everywhere (compose profiles match `DB_CONNECTION`).
- No TBD steps; pgloader invoked via Docker image `dimitri/pgloader`.
- Sequence reset included after data load.

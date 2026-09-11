# Postgres primary OLTP with MySQL dual support

**Date:** 2026-09-10  
**Status:** Approved for planning  
**Approach:** Env-driven dual engine (Goravel mysql + postgres), Postgres default for new installs

## Problem

The MoH Performance Management System uses MySQL 8.4 as the only primary OLTP database in deploy/setup defaults. Operators want:

1. **PostgreSQL as the default** primary database for new installs.
2. **MySQL remaining fully supported** so installers can choose at setup time.
3. **This project's current MySQL data migrated** to Postgres via an offline one-shot tool.

Apache Doris (analytics) stays a separate store on the MySQL protocol and is out of scope for engine changes.

## Goals

- New installs default to Postgres (`DB_CONNECTION=postgres`, port `5432`).
- Setup UX: interactive prompt **and** `--db postgres|mysql` / env override.
- Docker Compose defines both DB services but **starts only the chosen engine**.
- Schema migrations run cleanly on both engines (no MySQL-only raw SQL on the critical path).
- Offline MySQL→Postgres cutover script with verification and documented rollback.
- Cut over the current project environment to Postgres after the dual-support work lands.

## Non-goals

- Changing Doris / analytics (`ANALYTICS_DB_*` remains MySQL-protocol client).
- Continuous replication or zero-downtime HA cutover.
- Removing the MySQL Goravel driver or MySQL compose service definition.
- Rewriting the entire schema in Postgres-only idioms (Approach B rejected).

## Architecture

```
┌─────────────────────┐
│  setup.sh / .env    │  DB_CONNECTION=postgres|mysql
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  docker compose     │  starts only matching DB service
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Goravel API        │  config/database.go → mysql | postgres driver
└─────────┬───────────┘
          │
     ┌────┴────┐
     ▼         ▼
 Postgres   MySQL
 (default)  (optional)

Doris analytics ── separate (always MySQL protocol :9030)
```

Driver selection remains a single env switch already supported by Goravel:

- `backend/config/database.go` — connections `postgres` and `mysql`
- `backend/bootstrap/providers.go` — both providers registered
- `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
- Postgres optional: `DB_SCHEMA` (default `public`)

## Setup UX & configuration

### `setup.sh`

- When `DB_CONNECTION` is unset and no `--db` flag: prompt  
  `Primary database? [1] PostgreSQL (default)  [2] MySQL`
- Flags: `--db postgres` | `--db mysql` (non-interactive; overrides prompt and can override existing env when explicitly passed).
- Default with no input: **postgres**.
- Writes `deploy/.env` with engine-neutral `DB_*` plus container secrets:
  - Postgres: `POSTGRES_PASSWORD` (and related) as needed by the image
  - MySQL: keep generating `MYSQL_*` for MySQL mode (backward compatible)
- Update `--logs` / help text to list `postgres` and `mysql`.

### Env examples

- `deploy/env.deploy.example` and `backend/.env.example` default to Postgres.
- Document that advanced users may set `DB_CONNECTION` without the interactive prompt.
- During transition, map legacy `MYSQL_*` into `DB_*` when `DB_CONNECTION=mysql` so older `.env` files keep working.

### Entrypoints

- `backend/scripts/docker-entrypoint.sh` and `docker-dev-entrypoint.sh` must **stop hardcoding** `DB_CONNECTION=mysql`.
- Honor compose-injected `DB_*`; fill missing defaults from `DB_CONNECTION` (port `5432` vs `3306`).

### Compose

- Root `docker-compose.yml` and `deploy/docker-compose.prod.yml`:
  - Define both `postgres` and `mysql` services.
  - Start only the service matching `DB_CONNECTION` (e.g. conditional include, profile gated by setup-generated override, or setup writes an override that enables one service).
- Preferred mechanism: `setup.sh` writes `deploy/docker-compose.override.yml` (or equivalent) so only the chosen DB service is enabled for day-to-day runs.
- Cutover temporarily may start both engines under operator control; normal operation starts one.

### Dev scripts

- `scripts/dev.sh` and related docs: start Redis + chosen DB (default Postgres).

## Portable migrations

Keep Goravel schema blueprints as the primary migration style. Fix dialect-specific raw SQL so **fresh Postgres** and **fresh MySQL** installs both succeed.

| Area | Current issue | Direction |
|------|---------------|-----------|
| Profile assets | `MODIFY … LONGTEXT` / `VARCHAR` | Dialect-aware `ALTER`, or no-op when type already correct |
| Leave workflow indexes | MySQL `DROP INDEX` / `ADD UNIQUE INDEX` | Postgres `DROP CONSTRAINT` / `CREATE UNIQUE INDEX` (or schema builder) |
| Geography hierarchy | MySQL `UPDATE … JOIN … SET` | Portable `UPDATE … FROM` / subquery |
| KPI subject area | `.After("…")` column order | Omit on Postgres (ordering is cosmetic) |
| Unsigned integers / LongText | Blueprint helpers | Smoke-test full migrate on Postgres; adjust only if Goravel fails |

Legacy MySQL init SQL under `database/sql/legacy/` must not be required for Postgres installs (seed via app seeders or optional MySQL-only path).

## Offline MySQL → Postgres cutover tool

**Script:** `scripts/migrate-mysql-to-postgres.sh` (+ short doc section in `docs/DEPLOYMENT.md`).

**Flow (offline one-shot):**

1. Stop API / put stack in maintenance (no application writes).
2. Logical dump of MySQL app database (`mysqldump` or equivalent).
3. Start Postgres (may run alongside MySQL **only for this cutover**).
4. Run Goravel migrations against empty Postgres (schema only).
5. Load data (preferred: `pgloader` if available; else dump→CSV→`COPY` with type fixes for booleans, unsigned integers, and sequences/serial IDs).
6. Verification: table row counts + spot checks (admin user, staff count, recent leave/PPA rows).
7. Flip `DB_CONNECTION=postgres` (and related host/port), stop MySQL service for normal ops, restart app.
8. Keep MySQL data directory until operator confirms success (documented rollback: restore `DB_CONNECTION=mysql`, start MySQL, stop Postgres app use).

**Guards:**

- Refuse to load if Postgres already has non-empty app tables unless `--force`.
- Fail clearly if source dump is empty or connection credentials are wrong.

## Migrating this project

After dual-support code is merged and verified:

1. Run the cutover tool against the current MySQL volume used by this environment.
2. Leave the stack on Postgres as primary.
3. MySQL remains available as a setup choice for other installs; this environment does not keep MySQL running day-to-day.

## Testing / acceptance

- Clean Postgres: `artisan migrate` + seed + login + one CRUD path (e.g. profile / leave list).
- Clean MySQL: same smoke path (regression).
- `setup.sh --db postgres` and `setup.sh --db mysql` produce correct `.env` and start only the matching DB container.
- Cutover dry-run on a copy of current data: row counts match within expected tolerance; app boots on Postgres.
- Doris still connects independently; dashboards fall back to primary OLTP when Doris is down (wording may say “primary OLTP” not “MySQL”).

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Goravel unsigned / boolean mapping differs | Full migrate smoke on both engines; fix migrations early |
| Sequence / serial out of sync after load | Reset Postgres sequences to `MAX(id)` after import |
| Cutover data loss | Offline window; keep MySQL volume until verified; documented rollback |
| Compose accidentally starts both DBs in prod | Setup override enforces single service; docs warn operators |

## Implementation order (high level)

1. Env/compose/setup/entrypoint defaults → Postgres; MySQL selectable.
2. Dialect-safe migrations; verify migrate on both engines.
3. Cutover script + DEPLOYMENT docs.
4. Run cutover for this project; confirm app on Postgres.
5. Update README / DEPLOYMENT wording and backup examples (`pg_dump` primary; `mysqldump` for MySQL mode).

## Decisions log

| Decision | Choice |
|----------|--------|
| Architecture | Approach A — env-driven dual engine |
| Setup choice | Interactive prompt **and** env/`--db` override |
| Existing MySQL sites | Automated offline migration tool in scope |
| Compose | Start **only** the chosen engine |
| Cutover mode | Offline one-shot |
| This project | Migrate current data to Postgres |
| Analytics | Doris unchanged |

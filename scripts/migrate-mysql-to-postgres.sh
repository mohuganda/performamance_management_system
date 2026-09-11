#!/usr/bin/env bash
#
# Offline one-shot cutover: copy MoH PMS data from MySQL to Postgres, then
# flip DB_CONNECTION to postgres.
#
# Prerequisites:
#   - Docker Compose stack with MySQL currently serving the app
#   - deploy/.env present (or pass env vars)
#   - App write traffic stopped (script stops backend/frontend/gateway)
#
# Usage:
#   ./scripts/migrate-mysql-to-postgres.sh
#   ./scripts/migrate-mysql-to-postgres.sh --dry-run
#   ./scripts/migrate-mysql-to-postgres.sh --force
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/deploy"
ENV_FILE="${DEPLOY_DIR}/.env"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.prod.yml"
OVERRIDE_FILE="${DEPLOY_DIR}/docker-compose.override.yml"
DRY_RUN=false
FORCE=false

log() { printf '\033[1;32m[cutover]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[cutover]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[cutover]\033[0m %s\n' "$*" >&2; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --force) FORCE=true; shift ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *) err "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ ! -f "${ENV_FILE}" ]]; then
  err "Missing ${ENV_FILE}. Run setup.sh first or create deploy/.env."
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "${ENV_FILE}"
set +a

DB_NAME="${DB_DATABASE:-${MYSQL_DATABASE:-moh_pms}}"
DB_USER="${DB_USERNAME:-${MYSQL_USER:-pms}}"
DB_PASS="${DB_PASSWORD:-${MYSQL_PASSWORD:-}}"
MYSQL_ROOT="${MYSQL_ROOT_PASSWORD:-}"

if [[ -z "${DB_PASS}" ]]; then
  err "DB_PASSWORD / MYSQL_PASSWORD is empty in deploy/.env"
  exit 1
fi

compose() {
  local files=(-f "${COMPOSE_FILE}")
  if [[ -f "${OVERRIDE_FILE}" ]]; then
    files+=(-f "${OVERRIDE_FILE}")
  fi
  docker compose --env-file "${ENV_FILE}" "${files[@]}" "$@"
}

run() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    log "DRY-RUN: $*"
  else
    log "$*"
    "$@"
  fi
}

network_name() {
  docker inspect moh-pms-mysql -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null | head -1
}

table_count_mysql() {
  local table=$1
  docker exec moh-pms-mysql mysql -N -u"${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" \
    -e "SELECT COUNT(*) FROM \`${table}\`;" 2>/dev/null || echo "ERR"
}

table_count_postgres() {
  local table=$1
  docker exec moh-pms-postgres psql -U "${DB_USER}" -d "${DB_NAME}" -tAc \
    "SELECT COUNT(*) FROM ${table};" 2>/dev/null || echo "ERR"
}

log "Stopping application containers (keeping MySQL)..."
run compose --profile app --profile mysql stop backend frontend gateway || true

log "Ensuring MySQL is up..."
run compose --profile mysql up -d mysql
log "Starting Postgres alongside MySQL for cutover..."
run compose --profile postgres up -d postgres

if [[ "${DRY_RUN}" == "true" ]]; then
  log "Would wait for health, migrate schema on Postgres, run pgloader, compare counts, flip env."
  exit 0
fi

log "Waiting for MySQL and Postgres..."
for i in $(seq 1 60); do
  mysql_ok=false
  pg_ok=false
  docker exec moh-pms-mysql mysqladmin ping -h localhost -uroot -p"${MYSQL_ROOT}" --silent >/dev/null 2>&1 && mysql_ok=true
  docker exec moh-pms-postgres pg_isready -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1 && pg_ok=true
  if [[ "${mysql_ok}" == "true" && "${pg_ok}" == "true" ]]; then
    break
  fi
  sleep 3
done

if ! docker exec moh-pms-postgres pg_isready -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; then
  err "Postgres did not become ready"
  exit 1
fi

pg_tables_raw="$(docker exec moh-pms-postgres psql -U "${DB_USER}" -d "${DB_NAME}" -tAc \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';" 2>/dev/null || true)"
pg_tables="$(printf '%s' "${pg_tables_raw:-0}" | tr -d '[:space:]')"
pg_tables="${pg_tables:-0}"
if [[ "${pg_tables}" != "0" && "${FORCE}" != "true" ]]; then
  user_rows_raw="$(docker exec moh-pms-postgres psql -U "${DB_USER}" -d "${DB_NAME}" -tAc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='users';" 2>/dev/null || true)"
  user_rows="$(printf '%s' "${user_rows_raw:-0}" | tr -d '[:space:]')"
  user_rows="${user_rows:-0}"
  if [[ "${user_rows}" == "1" ]]; then
    users_n="$(table_count_postgres users | tr -d '[:space:]')"
    users_n="${users_n:-ERR}"
    if [[ "${users_n}" != "0" && "${users_n}" != "ERR" ]]; then
      err "Postgres already has data (users=${users_n}). Re-run with --force to continue."
      exit 1
    fi
  fi
fi

log "Creating Postgres schema via artisan migrate..."
BACKEND_IMAGE=$(docker inspect moh-pms-api --format '{{.Image}}' 2>/dev/null || true)
if [[ -z "${BACKEND_IMAGE}" ]]; then
  log "Building backend image for migrate..."
  compose --profile app --profile postgres build backend
  BACKEND_IMAGE=$(docker inspect moh-pms-api --format '{{.Image}}' 2>/dev/null || true)
fi
if [[ -z "${BACKEND_IMAGE}" ]]; then
  # Fall back to compose project image name
  BACKEND_IMAGE="deploy-backend"
fi

NET="$(network_name)"
if [[ -z "${NET}" ]]; then
  err "Could not detect Docker network for moh-pms-mysql"
  exit 1
fi

docker run --rm --network "${NET}" \
  -e APP_ENV=production \
  -e APP_KEY="${APP_KEY:-0123456789abcdef0123456789abcdef}" \
  -e JWT_SECRET="${JWT_SECRET:-cutover-jwt-secret}" \
  -e DB_CONNECTION=postgres \
  -e DB_HOST=postgres \
  -e DB_PORT=5432 \
  -e DB_DATABASE="${DB_NAME}" \
  -e DB_USERNAME="${DB_USER}" \
  -e DB_PASSWORD="${DB_PASS}" \
  -e DB_SCHEMA=public \
  -e REDIS_HOST=redis \
  -e LOAD_DEMO_DATA=false \
  --entrypoint /bin/sh \
  "${BACKEND_IMAGE}" \
  -c 'printf "%s\n" \
    "APP_KEY=${APP_KEY}" \
    "APP_ENV=production" \
    "DB_CONNECTION=postgres" \
    "DB_HOST=postgres" \
    "DB_PORT=5432" \
    "DB_DATABASE=${DB_DATABASE}" \
    "DB_USERNAME=${DB_USERNAME}" \
    "DB_PASSWORD=${DB_PASSWORD}" \
    "DB_SCHEMA=public" \
    "JWT_SECRET=${JWT_SECRET}" \
    "REDIS_HOST=redis" > /app/.env && ./moh-pms-api artisan migrate'

log "Loading data with pgloader (MySQL → Postgres)..."
# Prefer data-only after schema migrate; fall back to full load if unsupported.
if ! docker run --rm --network "${NET}" dimitri/pgloader:latest \
  pgloader \
  --with "data only" \
  --with "prefetch rows = 1000" \
  "mysql://${DB_USER}:${DB_PASS}@mysql:3306/${DB_NAME}" \
  "postgresql://${DB_USER}:${DB_PASS}@postgres:5432/${DB_NAME}"; then
  warn "data-only pgloader failed; retrying full load"
  docker run --rm --network "${NET}" dimitri/pgloader:latest \
    pgloader \
    "mysql://${DB_USER}:${DB_PASS}@mysql:3306/${DB_NAME}" \
    "postgresql://${DB_USER}:${DB_PASS}@postgres:5432/${DB_NAME}"
fi

log "Repairing users.is_active from MySQL (TINYINT → boolean cast is often wrong)..."
# Without this, login returns "account is disabled" even when row counts match.
docker exec moh-pms-mysql mysql -N -u"${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" \
  -e "SELECT LOWER(email), IF(COALESCE(is_active,1)=1,'true','false') FROM users;" 2>/dev/null \
| while IFS=$'\t' read -r email active; do
    [[ -z "${email}" ]] && continue
    email_esc="${email//\'/\'\'}"
    docker exec moh-pms-postgres psql -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 \
      -c "UPDATE users SET is_active = ${active} WHERE LOWER(email) = '${email_esc}';" >/dev/null
  done || warn "Could not sync users.is_active from MySQL — run: UPDATE users SET is_active = true;"

docker exec moh-pms-postgres psql -U "${DB_USER}" -d "${DB_NAME}" -c \
  "UPDATE roles SET is_active = COALESCE(is_active, true) WHERE is_active IS NULL;" >/dev/null || true

log "Resetting Postgres sequences..."
docker exec -i moh-pms-postgres psql -U "${DB_USER}" -d "${DB_NAME}" <<'SQL'
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name,
           pg_get_serial_sequence(quote_ident(n.nspname)||'.'||quote_ident(c.relname), a.attname) AS seq
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND pg_get_serial_sequence(quote_ident(n.nspname)||'.'||quote_ident(c.relname), a.attname) IS NOT NULL
  LOOP
    EXECUTE format(
      'SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %I.%I), 1))',
      r.seq, r.column_name, r.schema_name, r.table_name
    );
  END LOOP;
END $$;
SQL

log "Comparing row counts..."
ok=true
for table in users staff_hr_profiles leave_requests system_configs; do
  m=$(table_count_mysql "${table}" | tr -d '[:space:]')
  p=$(table_count_postgres "${table}" | tr -d '[:space:]')
  if [[ "${m}" == "${p}" && "${m}" != "ERR" ]]; then
    log "  ${table}: mysql=${m} postgres=${p} OK"
  else
    warn "  ${table}: mysql=${m} postgres=${p} MISMATCH"
    ok=false
  fi
done

pg_users="$(table_count_postgres users | tr -d '[:space:]')"
pg_users="${pg_users:-ERR}"
if [[ "${pg_users}" == "0" || "${pg_users}" == "ERR" ]]; then
  err "Postgres users table is empty after pgloader (count=${pg_users})."
  err "Refusing to flip DB_CONNECTION. Fix data load, then re-run with --force."
  err "Check: docker logs from the pgloader step above; MySQL still has rows?"
  exit 1
fi

if [[ "${ok}" != "true" ]]; then
  warn "Some table counts mismatched — investigate before removing MySQL."
  if [[ "${FORCE}" != "true" ]]; then
    err "Refusing to flip DB_CONNECTION on mismatched counts. Re-run with --force to override."
    exit 2
  fi
  warn "--force set: continuing despite mismatches."
fi

log "Updating deploy/.env to postgres..."
tmp="$(mktemp)"
awk '
  BEGIN { done_conn=0; done_host=0; done_port=0 }
  /^DB_CONNECTION=/ { print "DB_CONNECTION=postgres"; done_conn=1; next }
  /^DB_HOST=/ { print "DB_HOST=postgres"; done_host=1; next }
  /^DB_PORT=/ { print "DB_PORT=5432"; done_port=1; next }
  { print }
  END {
    if (!done_conn) print "DB_CONNECTION=postgres"
    if (!done_host) print "DB_HOST=postgres"
    if (!done_port) print "DB_PORT=5432"
  }
' "${ENV_FILE}" > "${tmp}"
mv "${tmp}" "${ENV_FILE}"
chmod 600 "${ENV_FILE}"

log "Starting app on Postgres only..."
compose --profile app --profile postgres up -d --build backend frontend gateway redis postgres

cat <<EOF

================================================================================
  Cutover complete (verify before deleting MySQL data)
================================================================================
  DB_CONNECTION=postgres
  Keep ${DATA_DIR:-/var/lib/moh-pms}/mysql until you confirm login and data.

  Rollback:
    1. Edit deploy/.env → DB_CONNECTION=mysql, DB_HOST=mysql, DB_PORT=3306
    2. ./setup.sh --db mysql --restart   (or compose --profile app --profile mysql up -d)

  Next:
    Open the app, sign in, spot-check staff / leave / settings.
================================================================================
EOF

if [[ "${ok}" != "true" ]]; then
  warn "Some table counts mismatched — investigate before removing MySQL."
fi

exit 0

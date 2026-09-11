#!/usr/bin/env bash
#
# Smoke-test: run the full Goravel migration set against a throwaway Postgres 16.
#
# Prefers a host `go build` (fast on Apple Silicon → Colima arm64) and falls back
# to a Docker image build when Go is unavailable.
#
# Usage:
#   ./scripts/smoke-postgres-migrate.sh
#   ./scripts/smoke-postgres-migrate.sh --docker-build   # force image build path
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NETWORK="pms-migrate-smoke"
PG_NAME="pms-migrate-smoke-pg"
API_NAME="pms-migrate-smoke-api"
PG_PASS="smoke_secret"
EXPECTED_MIN_MIGRATIONS=30
FORCE_DOCKER_BUILD=false
# Binary must live under the project tree so Colima/Docker Desktop can bind-mount it.
mkdir -p "${ROOT_DIR}/backend/.tmp"
BIN="${ROOT_DIR}/backend/.tmp/moh-pms-api-smoke"

log() { printf '\033[1;36m[smoke-pg]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[smoke-pg]\033[0m %s\n' "$*" >&2; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --docker-build) FORCE_DOCKER_BUILD=true; shift ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) err "Unknown option: $1"; exit 1 ;;
  esac
done

export DOCKER_BUILDKIT=1

cleanup() {
  docker rm -f "${API_NAME}" "${PG_NAME}" >/dev/null 2>&1 || true
  docker network rm "${NETWORK}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup
docker network create "${NETWORK}" >/dev/null

log "Starting throwaway Postgres 16..."
docker run -d --name "${PG_NAME}" --network "${NETWORK}" \
  -e POSTGRES_DB=moh_pms \
  -e POSTGRES_USER=pms \
  -e POSTGRES_PASSWORD="${PG_PASS}" \
  postgres:16-alpine >/dev/null

for _ in $(seq 1 40); do
  if docker exec "${PG_NAME}" pg_isready -U pms -d moh_pms >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! docker exec "${PG_NAME}" pg_isready -U pms -d moh_pms >/dev/null 2>&1; then
  err "Postgres did not become ready"
  exit 1
fi

ARCH="$(docker version -f '{{.Server.Arch}}' 2>/dev/null || echo arm64)"
USE_HOST_BIN=false
if [[ "${FORCE_DOCKER_BUILD}" != "true" ]] && command -v go >/dev/null 2>&1; then
  log "Cross-compiling API on host (linux/${ARCH})..."
  (
    cd "${ROOT_DIR}/backend"
    CGO_ENABLED=0 GOOS=linux GOARCH="${ARCH}" go build -trimpath -ldflags='-s -w' -o "${BIN}" .
  )
  USE_HOST_BIN=true
else
  log "Building backend image (BuildKit)..."
  docker build -f "${ROOT_DIR}/backend/Dockerfile" -t moh-pms-api:smoke "${ROOT_DIR}/backend"
fi

log "Running artisan migrate (no seed)..."
# Prefer an existing app image so config/database assets are present; override the binary when host-built.
BASE_IMAGE="deploy-backend"
if ! docker image inspect "${BASE_IMAGE}" >/dev/null 2>&1; then
  if docker image inspect moh-pms-api:smoke >/dev/null 2>&1; then
    BASE_IMAGE="moh-pms-api:smoke"
  else
    log "No local API image — building once..."
    docker build -f "${ROOT_DIR}/backend/Dockerfile" -t moh-pms-api:smoke "${ROOT_DIR}/backend"
    BASE_IMAGE="moh-pms-api:smoke"
  fi
fi

RUN_ARGS=(
  --name "${API_NAME}" --network "${NETWORK}"
  -e APP_ENV=production
  -e APP_KEY=0123456789abcdef0123456789abcdef
  -e JWT_SECRET=smoke-jwt-secret
  -e DB_CONNECTION=postgres
  -e DB_HOST="${PG_NAME}"
  -e DB_PORT=5432
  -e DB_DATABASE=moh_pms
  -e DB_USERNAME=pms
  -e DB_PASSWORD="${PG_PASS}"
  -e DB_SCHEMA=public
  -e REDIS_HOST=127.0.0.1
  -e LOAD_DEMO_DATA=false
  -e ADMIN_EMAIL=admin@moh.go.ug
  -e ADMIN_PASSWORD=Demo@Moh2026!
  -e ADMIN_NAME="PMS Administrator"
)
if [[ "${USE_HOST_BIN}" == "true" ]]; then
  RUN_ARGS+=(-v "${BIN}:/app/moh-pms-api:ro")
fi

docker run "${RUN_ARGS[@]}" \
  --entrypoint /bin/sh \
  "${BASE_IMAGE}" \
  -c 'printf "%s\n" \
    "APP_ENV=production" \
    "APP_KEY=${APP_KEY}" \
    "JWT_SECRET=${JWT_SECRET}" \
    "DB_CONNECTION=postgres" \
    "DB_HOST=${DB_HOST}" \
    "DB_PORT=5432" \
    "DB_DATABASE=moh_pms" \
    "DB_USERNAME=pms" \
    "DB_PASSWORD=${DB_PASSWORD}" \
    "DB_SCHEMA=public" \
    "REDIS_HOST=127.0.0.1" \
    "ADMIN_EMAIL=${ADMIN_EMAIL}" \
    "ADMIN_PASSWORD=${ADMIN_PASSWORD}" \
    "ADMIN_NAME=${ADMIN_NAME}" > /app/.env \
    && ./moh-pms-api artisan migrate'

COUNT=$(docker exec "${PG_NAME}" psql -U pms -d moh_pms -tAc "SELECT COUNT(*) FROM migrations;" | tr -d '[:space:]')
log "Recorded migrations: ${COUNT} (expect >= ${EXPECTED_MIN_MIGRATIONS})"

if [[ -z "${COUNT}" || "${COUNT}" -lt "${EXPECTED_MIN_MIGRATIONS}" ]]; then
  err "Migration smoke failed: only ${COUNT} rows in migrations table"
  docker exec "${PG_NAME}" psql -U pms -d moh_pms -c "SELECT migration FROM migrations ORDER BY id;"
  exit 1
fi

docker exec "${PG_NAME}" psql -U pms -d moh_pms -v ON_ERROR_STOP=1 <<'SQL'
SELECT 1 FROM regions LIMIT 1;
SELECT to_regclass('public.users') IS NOT NULL;
SELECT to_regclass('public.leave_approval_stages') IS NOT NULL;
SQL

log "PASS — Postgres migrations completed successfully (${COUNT} migrations)."

#!/usr/bin/env sh
# Dev entrypoint: write .env from container env, migrate, then start Air for hot reload.
set -eu

cd /app

mkdir -p storage/app/public storage/framework/cache storage/framework/sessions storage/logs tmp

env_quote() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/^/"/; s/$/"/'
}

cat > /app/.env <<EOF
APP_NAME=$(env_quote "${APP_NAME:-MoH-PMS}")
APP_ENV=$(env_quote "${APP_ENV:-local}")
APP_DEBUG=$(env_quote "${APP_DEBUG:-true}")
APP_KEY=$(env_quote "${APP_KEY:-base64:dev-key-change-in-production}")
APP_URL=$(env_quote "${APP_URL:-http://localhost:3030}")
APP_HOST=$(env_quote "${APP_HOST:-0.0.0.0}")
APP_PORT=$(env_quote "${APP_PORT:-3030}")
JWT_SECRET=$(env_quote "${JWT_SECRET:-dev-jwt-secret-change-me}")
SESSION_DRIVER=$(env_quote "${SESSION_DRIVER:-redis}")
SESSION_LIFETIME=$(env_quote "${SESSION_LIFETIME:-120}")
DB_CONNECTION=mysql
DB_HOST=$(env_quote "${DB_HOST:-mysql}")
DB_PORT=$(env_quote "${DB_PORT:-3306}")
DB_DATABASE=$(env_quote "${DB_DATABASE:-moh_pms}")
DB_USERNAME=$(env_quote "${DB_USERNAME:-pms}")
DB_PASSWORD=$(env_quote "${DB_PASSWORD:-pms_secret}")
REDIS_HOST=$(env_quote "${REDIS_HOST:-redis}")
REDIS_PORT=$(env_quote "${REDIS_PORT:-6379}")
ADMIN_EMAIL=$(env_quote "${ADMIN_EMAIL:-admin@moh.go.ug}")
ADMIN_PASSWORD=$(env_quote "${ADMIN_PASSWORD:-Demo@Moh2026!}")
ADMIN_NAME=$(env_quote "${ADMIN_NAME:-PMS Administrator}")
EOF

echo "[dev] Waiting for MySQL..."
attempt=1
while [ "$attempt" -le 30 ]; do
  if go run . artisan migrate 2>/dev/null; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 2
done

SEED_MARKER="/app/storage/.initial_seed_complete"
if [ "${LOAD_DEMO_DATA:-true}" = "true" ] && [ ! -f "${SEED_MARKER}" ]; then
  echo "[dev] Seeding demo data (first boot)..."
  if go run . artisan db:seed --force; then
    touch "${SEED_MARKER}"
  fi
fi

echo "[dev] Starting API with Air (auto-reload on .go changes)..."
exec air -c .air.toml

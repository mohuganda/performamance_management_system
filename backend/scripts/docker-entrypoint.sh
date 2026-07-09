#!/usr/bin/env sh
# Docker entrypoint: prepare storage, migrate, optionally seed demo data, then start API.
set -eu

cd /app

mkdir -p storage/app/public storage/framework/cache storage/framework/sessions storage/logs

write_runtime_env() {
  cat > /app/.env <<EOF
APP_NAME=${APP_NAME:-MoH-PMS}
APP_ENV=${APP_ENV:-production}
APP_DEBUG=${APP_DEBUG:-false}
APP_KEY=${APP_KEY}
APP_URL=${APP_URL:-http://localhost}
APP_HOST=${APP_HOST:-0.0.0.0}
APP_PORT=${APP_PORT:-3030}
JWT_SECRET=${JWT_SECRET}
SESSION_DRIVER=${SESSION_DRIVER:-redis}
SESSION_LIFETIME=${SESSION_LIFETIME:-120}
DB_CONNECTION=mysql
DB_HOST=${DB_HOST:-mysql}
DB_PORT=${DB_PORT:-3306}
DB_DATABASE=${DB_DATABASE}
DB_USERNAME=${DB_USERNAME}
DB_PASSWORD=${DB_PASSWORD}
REDIS_HOST=${REDIS_HOST:-redis}
REDIS_PORT=${REDIS_PORT:-6379}
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN_NAME=${ADMIN_NAME:-PMS Administrator}
EOF
}

run_migrate() {
  attempt=1
  while [ "$attempt" -le 12 ]; do
    if ./artisan migrate --force; then
      return 0
    fi
    echo "[entrypoint] migrate attempt ${attempt}/12 failed — retrying in 5s..."
    attempt=$((attempt + 1))
    sleep 5
  done
  echo "[entrypoint] migrate failed after 12 attempts"
  return 1
}

write_runtime_env

echo "[entrypoint] Running migrations..."
run_migrate

SEED_MARKER="/app/storage/.initial_seed_complete"
if [ "${LOAD_DEMO_DATA:-true}" = "true" ]; then
  if [ -f "${SEED_MARKER}" ]; then
    echo "[entrypoint] Demo seed already completed (${SEED_MARKER}); skipping db:seed"
  else
    echo "[entrypoint] Loading demo data (first boot)..."
    if ./artisan db:seed; then
      touch "${SEED_MARKER}"
      echo "[entrypoint] Demo seed complete"
    else
      echo "[entrypoint] WARNING: db:seed failed — starting API anyway (check logs)"
    fi
  fi
else
  echo "[entrypoint] Skipping demo seed (LOAD_DEMO_DATA=false)"
fi

echo "[entrypoint] Starting MoH PMS API on ${APP_HOST:-0.0.0.0}:${APP_PORT:-3030}..."
exec ./moh-pms-api

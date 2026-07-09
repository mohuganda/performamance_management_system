#!/usr/bin/env sh
# Docker entrypoint: prepare storage, migrate, optionally seed demo data, then start API.
set -eu

cd /app

mkdir -p storage/app/public storage/framework/cache storage/framework/sessions storage/logs

# Quote values for .env (spaces/special chars in passwords and names)
env_quote() {
  printf '%s' "$1" | sed "s/'/'\\\\''/g; s/^/'/; s/$/'/"
}

write_runtime_env() {
  cat > /app/.env <<EOF
APP_NAME=$(env_quote "${APP_NAME:-MoH-PMS}")
APP_ENV=$(env_quote "${APP_ENV:-production}")
APP_DEBUG=$(env_quote "${APP_DEBUG:-false}")
APP_KEY=$(env_quote "${APP_KEY}")
APP_URL=$(env_quote "${APP_URL:-http://localhost}")
APP_HOST=$(env_quote "${APP_HOST:-0.0.0.0}")
APP_PORT=$(env_quote "${APP_PORT:-3030}")
JWT_SECRET=$(env_quote "${JWT_SECRET}")
SESSION_DRIVER=$(env_quote "${SESSION_DRIVER:-redis}")
SESSION_LIFETIME=$(env_quote "${SESSION_LIFETIME:-120}")
DB_CONNECTION=mysql
DB_HOST=$(env_quote "${DB_HOST:-mysql}")
DB_PORT=$(env_quote "${DB_PORT:-3306}")
DB_DATABASE=$(env_quote "${DB_DATABASE}")
DB_USERNAME=$(env_quote "${DB_USERNAME}")
DB_PASSWORD=$(env_quote "${DB_PASSWORD}")
REDIS_HOST=$(env_quote "${REDIS_HOST:-redis}")
REDIS_PORT=$(env_quote "${REDIS_PORT:-6379}")
ADMIN_EMAIL=$(env_quote "${ADMIN_EMAIL}")
ADMIN_PASSWORD=$(env_quote "${ADMIN_PASSWORD}")
ADMIN_NAME=$(env_quote "${ADMIN_NAME:-PMS Administrator}")
EOF
}

run_artisan() {
  ./moh-pms-api artisan "$@"
}

run_migrate() {
  attempt=1
  while [ "$attempt" -le 12 ]; do
    if run_artisan migrate --force; then
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
    if run_artisan db:seed; then
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

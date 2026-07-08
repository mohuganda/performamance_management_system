#!/usr/bin/env sh
# Docker entrypoint: migrate, optionally seed demo data, then start API.
set -eu

cd /app

echo "[entrypoint] Running migrations..."
./artisan migrate --force

if [ "${LOAD_DEMO_DATA:-true}" = "true" ]; then
  echo "[entrypoint] Loading demo data (LOAD_DEMO_DATA=${LOAD_DEMO_DATA:-true})..."
  ./artisan db:seed
else
  echo "[entrypoint] Skipping demo seed (LOAD_DEMO_DATA=false)"
fi

echo "[entrypoint] Starting MoH PMS API..."
exec ./moh-pms-api

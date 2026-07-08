#!/usr/bin/env sh
# Load MoH PMS demo data (districts, RBAC, demo accounts, KPIs, leave config, etc.)
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/backend"

ARTISAN="./artisan"
if [ ! -x "$ARTISAN" ]; then
  ARTISAN="go run . artisan"
fi

echo "[demo] Running database migrations..."
sh -c "$ARTISAN migrate --force"

echo "[demo] Seeding demo data..."
sh -c "$ARTISAN db:seed"

echo "[demo] Demo data ready."
echo "  Demo login: worker@moh.go.ug / Demo@Moh2026!"
echo "  HR login:   hr@moh.go.ug / Demo@Moh2026!"

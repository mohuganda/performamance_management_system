#!/usr/bin/env bash
#
# Start MoH PMS in development mode with automatic reload.
#
#   ./scripts/dev.sh              # Docker: Vite HMR + Air hot reload (recommended)
#   ./scripts/dev.sh --local      # Native: Air + Vite on host (MySQL/Redis in Docker)
#   ./scripts/dev.sh --build      # Force rebuild dev images
#   ./scripts/dev.sh --down       # Stop dev stack
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="docker compose -f ${ROOT_DIR}/docker-compose.yml -f ${ROOT_DIR}/docker-compose.dev.yml"

MODE="docker"
BUILD=""
ACTION="up"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local) MODE="local"; shift ;;
    --build) BUILD="--build"; shift ;;
    --down)
      ACTION="down"
      shift
      ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

log() { printf '\033[1;36m[dev]\033[0m %s\n' "$*"; }

if [[ "${ACTION}" == "down" ]]; then
  log "Stopping development stack..."
  ${COMPOSE} down
  exit 0
fi

if [[ "${MODE}" == "local" ]]; then
  log "Starting MySQL + Redis in Docker..."
  docker compose -f "${ROOT_DIR}/docker-compose.yml" up -d mysql redis

  log "Backend: Air hot reload on http://127.0.0.1:3030"
  log "Frontend: Vite HMR on http://127.0.0.1:5173"
  log "Press Ctrl+C to stop."

  cleanup() {
    kill "${BACKEND_PID:-}" "${FRONTEND_PID:-}" 2>/dev/null || true
    wait 2>/dev/null || true
  }
  trap cleanup EXIT INT TERM

  (
    cd "${ROOT_DIR}/backend"
    if ! command -v air >/dev/null 2>&1; then
      log "Installing Air..."
      go install github.com/air-verse/air@latest
    fi
    air -c .air.toml
  ) &
  BACKEND_PID=$!

  (
    cd "${ROOT_DIR}/frontend"
    if [[ ! -d node_modules ]]; then
      npm ci --legacy-peer-deps
    fi
    npm run dev
  ) &
  FRONTEND_PID=$!

  wait
  exit 0
fi

log "Starting Docker dev stack (auto-reload enabled)..."
log "  Frontend → http://localhost:5173"
log "  API      → http://localhost:3030/api/v1"
log "  Swagger  → http://localhost:3030/swagger/index.html"
${COMPOSE} up ${BUILD} --remove-orphans

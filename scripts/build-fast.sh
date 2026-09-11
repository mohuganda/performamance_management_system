#!/usr/bin/env bash
#
# Fast production image builds.
#
# Backend default: cross-compile on the host (seconds) + slim runtime image.
# Falls back to full Docker Go build when `go` is missing or --docker-go is set.
# Frontend uses BuildKit npm cache mounts.
#
# Usage:
#   ./scripts/build-fast.sh              # backend + frontend
#   ./scripts/build-fast.sh backend
#   ./scripts/build-fast.sh frontend
#   ./scripts/build-fast.sh backend --docker-go   # in-container go build
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="all"
DOCKER_GO=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    all|backend|frontend) TARGET="$1"; shift ;;
    --docker-go) DOCKER_GO=true; shift ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "Usage: $0 [all|backend|frontend] [--docker-go]" >&2; exit 1 ;;
  esac
done

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
export COMPOSE_BAKE="${COMPOSE_BAKE:-true}"

ENV_FILE="${ROOT_DIR}/deploy/.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  ENV_FILE="${ROOT_DIR}/deploy/env.deploy.example"
fi

# Resolve DB profile from env file when present
DB_CONNECTION="${DB_CONNECTION:-}"
if [[ -z "${DB_CONNECTION}" && -f "${ENV_FILE}" ]]; then
  DB_CONNECTION="$(grep -E '^DB_CONNECTION=' "${ENV_FILE}" | head -1 | cut -d= -f2- | tr -d '"' || true)"
fi
DB_CONNECTION="${DB_CONNECTION:-postgres}"

COMPOSE=(docker compose -f "${ROOT_DIR}/deploy/docker-compose.prod.yml" --env-file "${ENV_FILE}" --profile app --profile "${DB_CONNECTION}")

log() { printf '\033[1;36m[build-fast]\033[0m %s\n' "$*"; }

build_backend_host() {
  local arch bin
  arch="$(docker version -f '{{.Server.Arch}}' 2>/dev/null || echo arm64)"
  mkdir -p "${ROOT_DIR}/backend/.tmp"
  bin="${ROOT_DIR}/backend/.tmp/moh-pms-api"
  log "Cross-compiling API on host (linux/${arch})..."
  (
    cd "${ROOT_DIR}/backend"
    CGO_ENABLED=0 GOOS=linux GOARCH="${arch}" go build -trimpath -ldflags='-s -w' -o "${bin}" .
  )
  log "Packaging runtime image (Dockerfile.prebuilt)..."
  docker build -f "${ROOT_DIR}/backend/Dockerfile.prebuilt" \
    -t deploy-backend \
    -t moh-pms-api:latest \
    "${ROOT_DIR}/backend"
}

build_backend_docker() {
  log "Building backend via Docker Go toolchain..."
  "${COMPOSE[@]}" build backend
}

build_backend() {
  if [[ "${DOCKER_GO}" == "true" ]] || ! command -v go >/dev/null 2>&1; then
    build_backend_docker
  else
    build_backend_host
  fi
}

build_frontend() {
  log "Building frontend (BuildKit npm cache)..."
  "${COMPOSE[@]}" build frontend
}

case "${TARGET}" in
  backend) build_backend ;;
  frontend) build_frontend ;;
  all)
    build_backend
    build_frontend
    ;;
esac

log "Done."

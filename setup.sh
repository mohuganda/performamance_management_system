#!/usr/bin/env bash
#
# MoH PMS — production deployment on a Linux server with Docker + nginx.
#
# Usage:
#   ./setup.sh                          # deploy with defaults (demo data, auto IP)
#   ./setup.sh --no-demo-data           # production without demo seed
#   ./setup.sh --host 203.0.113.10      # set public IP/hostname
#   ./setup.sh --http-port 80           # port users open in browser
#   ./setup.sh --install-host-nginx     # proxy via system nginx on port 80
#   ./setup.sh --down                   # stop stack
#   ./setup.sh --help
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="${ROOT_DIR}/deploy"
ENV_FILE="${DEPLOY_DIR}/.env"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.prod.yml"
OVERRIDE_FILE="${DEPLOY_DIR}/docker-compose.override.yml"
NGINX_SITE_NAME="moh-pms"
NGINX_AVAILABLE="/etc/nginx/sites-available/${NGINX_SITE_NAME}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${NGINX_SITE_NAME}"

# Defaults (overridden by flags or existing deploy/.env)
PUBLIC_HOST=""
HTTP_PORT="80"
GATEWAY_PORT="8080"
LOAD_DEMO_DATA="true"
IHRIS_USE_DEMO_DATA="true"
ADMIN_EMAIL="admin@moh.go.ug"
ADMIN_PASSWORD="Demo@Moh2026!"
ADMIN_NAME="PMS Administrator"
MYSQL_ROOT_PASSWORD=""
MYSQL_PASSWORD=""
APP_KEY=""
JWT_SECRET=""
EXPOSE_MYSQL="false"
EXPOSE_REDIS="false"
MYSQL_HOST_PORT="3307"
REDIS_HOST_PORT="6379"
INSTALL_HOST_NGINX="false"
SERVER_NAME="_"
REBUILD="false"
ACTION="deploy"
VITE_API_BASE_URL="/api/v1"
# Set when matching CLI flag is passed (so deploy/.env cannot override)
CLI_HTTP_PORT=""
CLI_PUBLIC_HOST=""
CLI_LOAD_DEMO_DATA=""
CLI_IHRIS_USE_DEMO_DATA=""
CLI_INSTALL_HOST_NGINX=""
CLI_GATEWAY_PORT=""

log() { printf '\033[1;32m[setup]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[setup]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[setup]\033[0m %s\n' "$*" >&2; }

usage() {
  cat <<'EOF'
MoH PMS deployment (Docker + nginx)

Usage: ./setup.sh [options]

Deploy / manage:
  (no args)              Build and start the stack
  --down                 Stop and remove containers (keeps volumes)
  --down-volumes         Stop and remove containers + database volumes
  --restart              Restart running containers
  --status               Show container status
  --logs [service]       Tail logs (gateway|backend|frontend|mysql|redis)

Network:
  --host IP              Public IP or hostname (auto-detected if omitted)
  --http-port PORT       Browser port (default: 80). Docker gateway or host nginx.
  --gateway-port PORT    Internal Docker gateway port when using --install-host-nginx (default: 8080)
  --server-name NAME     nginx server_name (default: _)

Data & demo:
  --demo-data            Load demo accounts and sample data (default)
  --no-demo-data         Skip database seeding
  --ihris-demo           Use legacy ihris demo table (default with demo data)
  --no-ihris-demo        Disable ihris demo data source

Credentials (auto-generated when omitted):
  --admin-email EMAIL    Seeded admin email (default: admin@moh.go.ug)
  --admin-password PASS  Seeded admin password (min 10 chars)
  --db-password PASS     MySQL application user password
  --mysql-root-password PASS
  --app-key KEY          Goravel APP_KEY
  --jwt-secret SECRET    JWT signing secret

Infrastructure:
  --rebuild              Force Docker image rebuild
  --expose-mysql         Publish MySQL on host port (default 3307)
  --expose-redis         Publish Redis on host port (default 6379)
  --install-host-nginx   Install site config into system nginx (requires sudo)
  --help                 Show this help

Examples:
  ./setup.sh
  ./setup.sh --host 192.168.1.50 --http-port 80 --demo-data
  ./setup.sh --no-demo-data --admin-password 'SecurePass123!' --install-host-nginx
  ./setup.sh --down

After deploy, open: http://<your-server-ip>/
Demo login (when --demo-data): worker@moh.go.ug / Demo@Moh2026!
EOF
}

detect_host_ip() {
  local ip=""
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')" || true
  if [[ -z "${ip}" ]]; then
    ip="$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}')" || true
  fi
  if [[ -z "${ip}" ]]; then
    ip="127.0.0.1"
    warn "Could not detect server IP; using 127.0.0.1. Pass --host explicitly."
  fi
  printf '%s' "${ip}"
}

rand_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32 | tr -d '\n=/' | head -c 32
  else
    head -c 32 /dev/urandom | base64 | tr -d '\n=/' | head -c 32
  fi
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    err "Docker is not installed. Install Docker Engine first:"
    err "  https://docs.docker.com/engine/install/"
    exit 1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    err "Docker Compose plugin is not available. Install docker-compose-plugin."
    exit 1
  fi
}

compose() {
  local files=(-f "${COMPOSE_FILE}")
  if [[ -f "${OVERRIDE_FILE}" ]]; then
    files+=(-f "${OVERRIDE_FILE}")
  fi
  docker compose --env-file "${ENV_FILE}" "${files[@]}" --profile app "$@"
}

write_override() {
  rm -f "${OVERRIDE_FILE}"
  local needs_file=false
  local content="services:"

  if [[ "${EXPOSE_MYSQL}" == "true" ]]; then
    needs_file=true
    content="${content}
  mysql:
    ports:
      - \"${MYSQL_HOST_PORT}:3306\""
  fi

  if [[ "${EXPOSE_REDIS}" == "true" ]]; then
    needs_file=true
    content="${content}
  redis:
    ports:
      - \"${REDIS_HOST_PORT}:6379\""
  fi

  if [[ "${INSTALL_HOST_NGINX}" == "true" ]]; then
    needs_file=true
    content="${content}
  gateway:
    ports:
      - \"127.0.0.1:${GATEWAY_PORT}:80\""
  fi

  if [[ "${needs_file}" == "true" ]]; then
    printf '%s\n' "${content}" > "${OVERRIDE_FILE}"
  fi
}

app_url() {
  if [[ "${HTTP_PORT}" == "80" ]]; then
    printf 'http://%s' "${PUBLIC_HOST}"
  else
    printf 'http://%s:%s' "${PUBLIC_HOST}" "${HTTP_PORT}"
  fi
}

write_env_file() {
  mkdir -p "${DEPLOY_DIR}"
  local url
  url="$(app_url)"
  cat > "${ENV_FILE}" <<EOF
# Generated by setup.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
PUBLIC_HOST=${PUBLIC_HOST}
HTTP_PORT=${HTTP_PORT}
GATEWAY_PORT=${GATEWAY_PORT}
LOAD_DEMO_DATA=${LOAD_DEMO_DATA}
IHRIS_USE_DEMO_DATA=${IHRIS_USE_DEMO_DATA}
APP_NAME=MoH-PMS
APP_ENV=production
APP_DEBUG=false
APP_URL=${url}
APP_KEY=${APP_KEY}
JWT_SECRET=${JWT_SECRET}
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN_NAME=${ADMIN_NAME}
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
MYSQL_DATABASE=moh_pms
MYSQL_USER=pms
MYSQL_PASSWORD=${MYSQL_PASSWORD}
EXPOSE_MYSQL=${EXPOSE_MYSQL}
EXPOSE_REDIS=${EXPOSE_REDIS}
MYSQL_HOST_PORT=${MYSQL_HOST_PORT}
REDIS_HOST_PORT=${REDIS_HOST_PORT}
VITE_API_BASE_URL=${VITE_API_BASE_URL}
INSTALL_HOST_NGINX=${INSTALL_HOST_NGINX}
SERVER_NAME=${SERVER_NAME}
EOF
  chmod 600 "${ENV_FILE}"
  log "Wrote ${ENV_FILE}"
}

install_host_nginx() {
  if ! command -v nginx >/dev/null 2>&1; then
    err "nginx is not installed. Install with: sudo apt install nginx"
    exit 1
  fi
  local template="${DEPLOY_DIR}/nginx/host-gateway.conf.template"
  local tmp
  tmp="$(mktemp)"
  sed \
    -e "s/__HTTP_PORT__/${HTTP_PORT}/g" \
    -e "s/__GATEWAY_PORT__/${GATEWAY_PORT}/g" \
    -e "s/__SERVER_NAME__/${SERVER_NAME}/g" \
    "${template}" > "${tmp}"

  log "Installing host nginx site (requires sudo)..."
  sudo cp "${tmp}" "${NGINX_AVAILABLE}"
  rm -f "${tmp}"
  sudo ln -sf "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"
  if [[ -f /etc/nginx/sites-enabled/default ]]; then
    sudo rm -f /etc/nginx/sites-enabled/default
    warn "Disabled nginx default site"
  fi
  sudo nginx -t
  sudo systemctl enable nginx
  sudo systemctl reload nginx
  log "Host nginx configured: ${NGINX_AVAILABLE}"
}

wait_for_api() {
  local url="http://127.0.0.1:${HTTP_PORT}/api/v1/health"
  log "Waiting for API health at ${url} ..."
  local i
  for i in $(seq 1 60); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      log "API is healthy"
      return 0
    fi
    sleep 3
  done
  warn "API health check timed out — check logs: ./setup.sh --logs backend"
  return 1
}

print_summary() {
  local access_url="http://${PUBLIC_HOST}"
  if [[ "${HTTP_PORT}" != "80" ]]; then
    access_url="${access_url}:${HTTP_PORT}"
  fi
  cat <<EOF

================================================================================
  MoH PMS deployed
================================================================================
  Web UI:     ${access_url}/
  API:        ${access_url}/api/v1
  Swagger:    ${access_url}/swagger/index.html

  Demo data:  ${LOAD_DEMO_DATA}
  iHRIS demo: ${IHRIS_USE_DEMO_DATA}
EOF
  if [[ "${LOAD_DEMO_DATA}" == "true" ]]; then
    cat <<EOF

  Demo login: worker@moh.go.ug / ${ADMIN_PASSWORD}
              hr@moh.go.ug / ${ADMIN_PASSWORD}
              admin@moh.go.ug / ${ADMIN_PASSWORD}
EOF
  fi
  cat <<EOF

  Env file:   ${ENV_FILE}
  Logs:       ./setup.sh --logs
  Stop:       ./setup.sh --down
================================================================================
EOF
}

# --- Parse arguments first (record overrides before deploy/.env is loaded) ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) PUBLIC_HOST="$2"; CLI_PUBLIC_HOST="$2"; shift 2 ;;
    --http-port) HTTP_PORT="$2"; CLI_HTTP_PORT="$2"; shift 2 ;;
    --gateway-port) GATEWAY_PORT="$2"; CLI_GATEWAY_PORT="$2"; shift 2 ;;
    --demo-data) LOAD_DEMO_DATA="true"; CLI_LOAD_DEMO_DATA="true"; shift ;;
    --no-demo-data) LOAD_DEMO_DATA="false"; CLI_LOAD_DEMO_DATA="false"; shift ;;
    --ihris-demo) IHRIS_USE_DEMO_DATA="true"; CLI_IHRIS_USE_DEMO_DATA="true"; shift ;;
    --no-ihris-demo) IHRIS_USE_DEMO_DATA="false"; CLI_IHRIS_USE_DEMO_DATA="false"; shift ;;
    --admin-email) ADMIN_EMAIL="$2"; shift 2 ;;
    --admin-password) ADMIN_PASSWORD="$2"; shift 2 ;;
    --db-password) MYSQL_PASSWORD="$2"; shift 2 ;;
    --mysql-root-password) MYSQL_ROOT_PASSWORD="$2"; shift 2 ;;
    --app-key) APP_KEY="$2"; shift 2 ;;
    --jwt-secret) JWT_SECRET="$2"; shift 2 ;;
    --expose-mysql) EXPOSE_MYSQL="true"; shift ;;
    --expose-reedis) EXPOSE_REDIS="true"; shift ;;
    --install-host-nginx) INSTALL_HOST_NGINX="true"; CLI_INSTALL_HOST_NGINX="true"; shift ;;
    --server-name) SERVER_NAME="$2"; shift 2 ;;
    --rebuild) REBUILD="true"; shift ;;
    --down) ACTION="down"; shift ;;
    --down-volumes) ACTION="down-volumes"; shift ;;
    --restart) ACTION="restart"; shift ;;
    --status) ACTION="status"; shift ;;
    --logs) ACTION="logs"; shift; LOGS_SERVICE="${2:-}"; [[ $# -gt 1 && "${2}" != --* ]] && shift || true ;;
    --help|-h) usage; exit 0 ;;
    *) err "Unknown option: $1"; usage; exit 1 ;;
  esac
done

# Load saved deploy env (secrets + prior settings); CLI flags above win for network/demo options
if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "${ENV_FILE}"
  set +a
fi
[[ -n "${CLI_PUBLIC_HOST}" ]] && PUBLIC_HOST="${CLI_PUBLIC_HOST}"
[[ -n "${CLI_HTTP_PORT}" ]] && HTTP_PORT="${CLI_HTTP_PORT}"
[[ -n "${CLI_GATEWAY_PORT}" ]] && GATEWAY_PORT="${CLI_GATEWAY_PORT}"
[[ -n "${CLI_LOAD_DEMO_DATA}" ]] && LOAD_DEMO_DATA="${CLI_LOAD_DEMO_DATA}"
[[ -n "${CLI_IHRIS_USE_DEMO_DATA}" ]] && IHRIS_USE_DEMO_DATA="${CLI_IHRIS_USE_DEMO_DATA}"
[[ -n "${CLI_INSTALL_HOST_NGINX}" ]] && INSTALL_HOST_NGINX="${CLI_INSTALL_HOST_NGINX}"

require_docker

if [[ "${ACTION}" == "deploy" ]]; then
  [[ -z "${MYSQL_ROOT_PASSWORD}" ]] && MYSQL_ROOT_PASSWORD="$(rand_secret)"
  [[ -z "${MYSQL_PASSWORD}" ]] && MYSQL_PASSWORD="$(rand_secret)"
  [[ -z "${APP_KEY}" ]] && APP_KEY="base64:$(openssl rand -base64 32 2>/dev/null || rand_secret)"
  [[ -z "${JWT_SECRET}" ]] && JWT_SECRET="$(rand_secret)"
fi

[[ -z "${PUBLIC_HOST}" ]] && PUBLIC_HOST="$(detect_host_ip)"

# Management actions
if [[ "${ACTION}" == "status" ]]; then
  compose ps
  exit 0
fi

if [[ "${ACTION}" == "logs" ]]; then
  if [[ -n "${LOGS_SERVICE:-}" ]]; then
    compose logs -f "${LOGS_SERVICE}"
  else
    compose logs -f
  fi
  exit 0
fi

if [[ "${ACTION}" == "down" ]]; then
  compose down
  log "Stack stopped (volumes preserved)"
  exit 0
fi

if [[ "${ACTION}" == "down-volumes" ]]; then
  compose down -v
  log "Stack stopped and volumes removed"
  exit 0
fi

if [[ "${ACTION}" == "restart" ]]; then
  compose restart
  log "Stack restarted"
  exit 0
fi

# --- Deploy ---
if [[ "${#ADMIN_PASSWORD}" -lt 10 ]]; then
  err "Admin password must be at least 10 characters (use --admin-password)"
  exit 1
fi

if [[ "${INSTALL_HOST_NGINX}" == "true" && "${HTTP_PORT}" == "80" && "${EUID}" -ne 0 ]]; then
  log "Host nginx will listen on port ${HTTP_PORT}; Docker gateway bound to 127.0.0.1:${GATEWAY_PORT}"
fi

write_env_file
write_override

log "Gateway will bind host port ${HTTP_PORT} (map to container :80)"

log "Building and starting containers..."
if [[ "${REBUILD}" == "true" ]]; then
  compose build --no-cache
fi
compose up -d --build

if [[ "${INSTALL_HOST_NGINX}" == "true" ]]; then
  install_host_nginx
fi

wait_for_api || true
print_summary

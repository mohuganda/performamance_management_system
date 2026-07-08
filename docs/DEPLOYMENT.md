# MoH PMS — Deployment Guide

This guide covers deploying the Performance Management System on a Linux server using **Docker** and **nginx**, accessible by server IP or hostname.

**Quick start:**

```bash
chmod +x setup.sh
./setup.sh
# Open http://<server-ip>/ in your browser
```

---

## Contents

1. [Server requirements](#1-server-requirements)
2. [Architecture](#2-architecture)
3. [First-time deployment](#3-first-time-deployment)
4. [setup.sh reference](#4-setupsh-reference)
5. [Deployment modes](#5-deployment-modes)
6. [Environment configuration](#6-environment-configuration)
7. [Operations](#7-operations)
8. [Firewall and networking](#8-firewall-and-networking)
9. [Production checklist](#9-production-checklist)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Server requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| OS | Ubuntu 22.04+ / Debian 12+ / RHEL 9+ | Ubuntu 24.04 LTS |
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disk | 20 GB free | 50 GB SSD |
| Software | Docker Engine 24+ with Compose plugin | Same |

### Install Docker (Ubuntu)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
# Log out and back in, then:
docker compose version
```

### Optional: system nginx

Required only when using `--install-host-nginx`:

```bash
sudo apt update && sudo apt install -y nginx
```

---

## 2. Architecture

### Production stack (`deploy/docker-compose.prod.yml`)

```text
                    ┌─────────────────────────────────────┐
  Browser           │  moh-pms-gateway (nginx)            │
  http://IP:80  ──► │  :80                                │
                    │    /        → frontend (static SPA) │
                    │    /api/    → backend :3030         │
                    │    /swagger → backend :3030         │
                    └──────────┬──────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
  moh-pms-web            moh-pms-api            moh-pms-mysql
  (React build)          (Goravel API)          moh-pms-redis
```

### File layout

```text
performamance_management_system/
├── setup.sh                         # Deployment script (start here)
├── docker-compose.yml               # Local dev compose (not production)
├── deploy/
│   ├── docker-compose.prod.yml      # Production stack
│   ├── docker-compose.override.yml  # Generated (optional ports / host nginx)
│   ├── .env                         # Generated secrets (git-ignored)
│   ├── env.deploy.example           # Env template reference
│   └── nginx/
│       ├── gateway.conf             # Docker gateway nginx config
│       ├── frontend.conf            # SPA static file serving
│       └── host-gateway.conf.template  # System nginx site template
└── frontend/Dockerfile.prod         # Production frontend image
```

### API URL in production

The frontend is built with `VITE_API_BASE_URL=/api/v1` (relative path). The browser calls the API on the **same host and port** as the web UI, so it works with any IP or domain without rebuilding.

---

## 3. First-time deployment

### Step 1 — Clone and enter the project

```bash
git clone <repository-url> moh-pms
cd moh-pms
```

### Step 2 — Run setup

**Demo / training server** (default — includes sample users and data):

```bash
chmod +x setup.sh
./setup.sh --host "$(hostname -I | awk '{print $1}')"
```

**Production server** (no demo seed):

```bash
./setup.sh \
  --no-demo-data \
  --host 203.0.113.50 \
  --admin-password 'YourSecureAdminPass123!'
```

### Step 3 — Verify

```bash
./setup.sh --status
curl -s http://127.0.0.1/api/v1/health
```

### Step 4 — Sign in

Open **`http://<server-ip>/`** in a browser.

| Mode | Login |
|------|-------|
| Demo (`--demo-data`) | `worker@moh.go.ug` / `Demo@Moh2026!` |
| Production | Account created by admin via Access Control |

---

## 4. setup.sh reference

### Deploy and manage

| Command | Description |
|---------|-------------|
| `./setup.sh` | Build images and start all services |
| `./setup.sh --rebuild` | Force rebuild without cache, then start |
| `./setup.sh --restart` | Restart running containers |
| `./setup.sh --status` | Show container status |
| `./setup.sh --logs` | Tail all service logs |
| `./setup.sh --logs backend` | Tail one service (`gateway`, `frontend`, `mysql`, `redis`) |
| `./setup.sh --down` | Stop containers (keeps database volumes) |
| `./setup.sh --down-volumes` | Stop and **delete** all data volumes |
| `./setup.sh --help` | Full option list |

### Network options

| Flag | Default | Description |
|------|---------|-------------|
| `--host IP` | auto-detect | Public IP or hostname shown in `APP_URL` and summary |
| `--http-port PORT` | `80` | Port users open in the browser |
| `--gateway-port PORT` | `8080` | Internal Docker gateway when using `--install-host-nginx` |
| `--server-name NAME` | `_` | nginx `server_name` for host nginx mode |

### Data and demo options

| Flag | Default | Description |
|------|---------|-------------|
| `--demo-data` | on | Run `db:seed` — demo users, KPIs, leave balances |
| `--no-demo-data` | — | Migrate only; no seed data |
| `--ihris-demo` | on (with demo) | Sync from legacy `ihrisdata` demo table |
| `--no-ihris-demo` | — | Disable iHRIS demo data source |

### Credential options

Auto-generated on first deploy if omitted. Stored in `deploy/.env`.

| Flag | Default | Description |
|------|---------|-------------|
| `--admin-email` | `admin@moh.go.ug` | Seeded administrator email |
| `--admin-password` | `Demo@Moh2026!` | Seeded admin password (min 10 chars) |
| `--db-password` | random | MySQL `pms` user password |
| `--mysql-root-password` | random | MySQL root password |
| `--app-key` | random | Goravel `APP_KEY` |
| `--jwt-secret` | random | JWT signing secret |

### Infrastructure options

| Flag | Default | Description |
|------|---------|-------------|
| `--expose-mysql` | off | Publish MySQL on host port 3307 |
| `--expose-redis` | off | Publish Redis on host port 6379 |
| `--install-host-nginx` | off | Install system nginx site proxying to Docker |

### Example commands

```bash
# LAN demo on port 8080 (no root required for port 80)
./setup.sh --host 192.168.1.50 --http-port 8080

# Production with host nginx on standard port 80
sudo ./setup.sh \
  --install-host-nginx \
  --host pms.moh.go.ug \
  --server-name pms.moh.go.ug \
  --no-demo-data \
  --admin-password 'MoH-Prod-2026!Secure'

# Redeploy after code update (preserves deploy/.env secrets)
git pull
./setup.sh --rebuild

# Wipe everything and start fresh
./setup.sh --down-volumes
./setup.sh --demo-data
```

---

## 5. Deployment modes

### Mode A — Docker gateway only (default)

- nginx runs **inside Docker** (`moh-pms-gateway`)
- Binds host port `--http-port` (default **80**)
- Simplest setup; one command

```bash
./setup.sh --host 203.0.113.50
# Users open: http://203.0.113.50/
```

> **Note:** Binding port 80 may require root privileges or membership in the `docker` group on some systems. Use `--http-port 8080` if port 80 is unavailable.

### Mode B — System nginx + Docker gateway

Use when the server already runs nginx or you need port 80 alongside other sites.

```bash
sudo ./setup.sh \
  --install-host-nginx \
  --host 203.0.113.50 \
  --http-port 80 \
  --gateway-port 8080
```

What happens:

1. Docker gateway binds **127.0.0.1:8080** only (not public)
2. `setup.sh` installs `/etc/nginx/sites-available/moh-pms`
3. Host nginx listens on **port 80** and proxies to Docker

Users open: **`http://203.0.113.50/`**

---

## 6. Environment configuration

`setup.sh` writes **`deploy/.env`**. Do not commit this file.

| Variable | Purpose |
|----------|---------|
| `PUBLIC_HOST` | Server IP or hostname |
| `HTTP_PORT` | External browser port |
| `LOAD_DEMO_DATA` | `true` / `false` — run seeders |
| `IHRIS_USE_DEMO_DATA` | Use legacy demo iHRIS table |
| `APP_URL` | Full public URL (`http://host` or `http://host:port`) |
| `APP_KEY` | Goravel encryption key |
| `JWT_SECRET` | API token signing |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seeded admin account |
| `MYSQL_*` | Database credentials |
| `VITE_API_BASE_URL` | Frontend API path (`/api/v1`) |

To change settings after first deploy, edit `deploy/.env` and run:

```bash
./setup.sh --restart
# or for image/config changes:
./setup.sh --rebuild
```

Reference template: [deploy/env.deploy.example](../deploy/env.deploy.example)

---

## 7. Operations

### View logs

```bash
./setup.sh --logs backend
./setup.sh --logs gateway
docker logs moh-pms-api --tail 100
```

### Database backups

```bash
docker exec moh-pms-mysql mysqldump -u pms -p moh_pms > backup-$(date +%F).sql
# Password is in deploy/.env → MYSQL_PASSWORD
```

### Update application

```bash
git pull origin main
./setup.sh --rebuild
```

### Stop and start

```bash
./setup.sh --down          # stop, keep data
./setup.sh                 # start again
```

---

## 8. Firewall and networking

Allow the HTTP port through your firewall:

```bash
# UFW (Ubuntu)
sudo ufw allow 80/tcp
sudo ufw allow 8080/tcp   # if using --http-port 8080

# firewalld (RHEL)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
```

### Cloud VMs

Open the same port in your security group (AWS, Azure, GCP, etc.) so browsers can reach the server IP.

### HTTPS (recommended for production)

`setup.sh` deploys HTTP only. For TLS:

1. Point a domain at the server
2. Install Certbot on the host nginx site, or
3. Place a TLS-terminating reverse proxy (e.g. Caddy, Traefik, cloud load balancer) in front of port 80/8080

Example with Certbot on host nginx (Mode B):

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d pms.moh.go.ug
```

---

## 9. Production checklist

Before go-live:

- [ ] Run with `--no-demo-data`
- [ ] Set strong `--admin-password` and store `deploy/.env` securely
- [ ] Set `--host` to the real public IP or domain
- [ ] Configure firewall / security group for HTTP(S)
- [ ] Enable HTTPS via Certbot or load balancer
- [ ] Do **not** use `--expose-mysql` or `--expose-redis` unless required
- [ ] Schedule MySQL backups
- [ ] Create real user accounts via **Access Control** (`/admin/rbac`)
- [ ] Configure iHRIS sync (`IHRIS_USE_DEMO_DATA=false`, set API credentials in backend env)
- [ ] Test sign-in, leave request, and performance report flows

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Cannot open `http://IP/` | Firewall or wrong port | Check `--http-port`, UFW, cloud security group |
| `Connection refused` on port 80 | Port in use or permission | Try `--http-port 8080` or use `--install-host-nginx` |
| Blank page / 502 | Backend not ready | `./setup.sh --logs backend`; wait for migrations |
| API errors in browser | Gateway misroute | Verify `curl http://127.0.0.1/api/v1/health` |
| Login fails (demo) | Demo not seeded | Redeploy with `--demo-data` or check `LOAD_DEMO_DATA` in `deploy/.env` |
| `setup.sh` permission denied | Not executable | `chmod +x setup.sh` |
| Database connection error | MySQL still starting | Wait 30s; `./setup.sh --logs mysql` |
| Need fresh database | Old volume data | `./setup.sh --down-volumes` then redeploy |

### Health checks

```bash
curl -s http://127.0.0.1/api/v1/health
curl -s http://127.0.0.1/api/v1/config | head
./setup.sh --status
```

### Compare with local dev

| | Local dev (`docker compose up`) | Production (`./setup.sh`) |
|--|--------------------------------|---------------------------|
| Frontend | Vite dev server :5173 | Static build + nginx |
| API URL | `http://localhost:3030/api/v1` | `/api/v1` (same origin) |
| Entry point | Separate ports | Single nginx gateway :80 |
| Compose file | `docker-compose.yml` | `deploy/docker-compose.prod.yml` |

---

## Related documents

- [README](../README.md) — project overview and developer setup
- [USER_GUIDE.md](USER_GUIDE.md) — end-user application guide
- [leave.md](../leave.md) — leave policy reference

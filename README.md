# MoH Uganda Performance Management System (PMS)

Integrated performance, leave, attendance, and workforce management platform for the **Ministry of Health Uganda**. The stack pairs **Goravel v1.18** (Go API) with a **React + TypeScript** SPA, **MySQL** (legacy iHRIS extract + normalized PMS schema), and **Redis** for caching and sessions.

**User documentation:** [docs/USER_GUIDE.md](docs/USER_GUIDE.md)  
**Deployment guide:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Features

| Area | Capabilities |
|------|----------------|
| **Dashboards** | Role-based views; **clickable drilldown tables**; Uganda district choropleth map; **overall performance score** on staff dashboard |
| **Performance** | KPI assignment, PPA planning, quarterly reporting, cumulative (YTD) indicators, **scoped status reports with Excel/PDF export** |
| **Leave** | Self-service requests with **searchable leave type**, multi-stage approval, balances, HR administration |
| **Out of station** | GPS destination requests with supervisor approval and geofenced attendance |
| **Attendance** | Mobile-style clock-in/out with location verification |
| **Administration** | Staff directory with **searchable supervisor/department fields**, KPI catalog, leave policy, RBAC, system configuration |
| **Notifications** | In-app alerts for approvals and system events |

## Architecture

```text
performamance_management_system/
├── setup.sh          # Production deployment script (Docker + nginx)
├── scripts/
│   └── load-demo-data.sh   # Migrate + seed demo data (local backend)
├── backend/          # Goravel v1.18 API
├── frontend/         # React + Vite + TypeScript SPA
├── deploy/           # Production compose, nginx configs, generated .env
├── database/sql/legacy/01_legacy_source_tables.sql
├── docker-compose.yml
└── docs/
    ├── DEPLOYMENT.md
    ├── USER_GUIDE.md
    └── REACT_IMPLEMENTATION_GUIDE.md
```

## Quick Start (Docker + demo data)

Demo users, KPIs, leave balances, and legacy iHRIS sample tables are loaded **automatically** (`LOAD_DEMO_DATA=true`, `IHRIS_USE_DEMO_DATA=true` in `docker-compose.yml`).

```bash
docker compose up --build
```

| Service  | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| API      | http://localhost:3030/api/v1 |
| Swagger  | http://localhost:3030/swagger/index.html |
| MySQL    | localhost:3307 (`moh_pms` / `pms` / `pms_secret`) |
| Redis    | localhost:6379 |

After containers are healthy, sign in with **`worker@moh.go.ug`** / **`Demo@Moh2026!`** (see [Demo accounts](#demo-accounts)).

To re-seed demo data without rebuilding containers:

```bash
chmod +x scripts/load-demo-data.sh
./scripts/load-demo-data.sh
```

Optional — import staff from the legacy `ihrisdata` demo table (sign in as HR first, or pass a JWT):

```bash
curl -X POST http://localhost:3030/api/v1/ihris/sync \
  -H "Authorization: Bearer <token>"
```

Or use **Settings → Data sources → Start iHRIS sync** in the web UI.

## Production deployment (Docker + nginx)

Use **`setup.sh`** on a Linux server with Docker installed. Full instructions: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

**Demo / training server** (default — seeds sample users and data):

```bash
chmod +x setup.sh
./setup.sh --host "$(hostname -I | awk '{print $1}')"
```

**Production** (no demo seed):

```bash
./setup.sh --no-demo-data --admin-password 'YourSecureAdminPass123!'
```

Open **`http://<server-ip>/`** in your browser (append `:PORT` if not using port 80).

### Quick examples

```bash
./setup.sh --host 203.0.113.50                    # explicit IP
./setup.sh --demo-data                            # ensure demo seed (default)
./setup.sh --no-demo-data --admin-password '…'    # production
./setup.sh --http-port 8080                       # non-standard port (see NPM below)
sudo ./setup.sh --install-host-nginx              # system nginx on :80
./setup.sh --rebuild                              # after code update
./setup.sh --down                                 # stop stack
./setup.sh --down-volumes && ./setup.sh --demo-data   # wipe DB and reseed demo
```

| Option | Default | Description |
|--------|---------|-------------|
| `--demo-data` / `--no-demo-data` | demo on | Seed demo users, KPIs, leave balances |
| `--ihris-demo` / `--no-ihris-demo` | on with demo | Load legacy `ihrisdata` demo table |
| `--http-port` | `80` | Port the Docker gateway binds on the host |
| `--install-host-nginx` | off | Install `/etc/nginx/sites-available/moh-pms` |
| `--expose-mysql` / `--expose-redis` | off | Publish data services on host |

Secrets are stored in **`deploy/.env`** (git-ignored). Run `./setup.sh --help` for all options.

### Nginx Proxy Manager (alternative to built-in gateway on :80)

Use this when **Nginx Proxy Manager** (or another reverse proxy) already owns ports **80/443** on the server. Do **not** use `--install-host-nginx`.

1. **Deploy PMS on an internal port** (e.g. 8080):

```bash
./setup.sh --demo-data --host pms.example.go.ug --http-port 8080
```

2. **Verify** on the server:

```bash
curl -s http://127.0.0.1:8080/api/v1/health
```

3. **In Nginx Proxy Manager** → Proxy Hosts → Add:

| Field | Value |
|-------|--------|
| Domain | `pms.example.go.ug` |
| Forward to | `http://127.0.0.1:8080` (same host) |
| Block common exploits | On |

4. **SSL tab** — request a certificate and force HTTPS.

The Docker **gateway** container routes `/` → frontend, `/api/` → backend, and `/swagger/` → API docs. NPM forwards the **entire site** to port 8080; no separate API proxy host is needed. Keep `VITE_API_BASE_URL=/api/v1` in `deploy/.env` (set by `setup.sh`) so the browser calls the API on the same domain.

### Stack layout

```text
Browser → nginx gateway (:80)
            ├── /        → frontend (static React build)
            ├── /api/    → backend (:3030)
            └── /swagger → API docs
```

## Local Development

### Prerequisites

- Go 1.22+
- Node.js 20+
- MySQL 8.x and Redis (or use Docker for data services only)

### Data services only (Docker)

```bash
docker compose up mysql redis -d
```

MySQL on **localhost:3307**, Redis on **localhost:6379**.

### Backend (with demo seed)

```bash
cd backend
cp .env.example .env
# Set DB_HOST=127.0.0.1, DB_PORT=3307, DB_DATABASE=moh_pms, DB_USERNAME=pms, DB_PASSWORD=pms_secret
# Set REDIS_HOST=127.0.0.1, ADMIN_PASSWORD=Demo@Moh2026! (min 10 chars)
# Optional: IHRIS_USE_DEMO_DATA=true in config/pms or system settings

go run . artisan key:generate
go run . artisan jwt:secret
go run . artisan migrate
go run . artisan db:seed    # demo accounts and sample data
go run .
```

Or from the repo root: `./scripts/load-demo-data.sh`

API listens on **http://127.0.0.1:3030**.

Regenerate Swagger after API changes:

```bash
cd backend
~/go/bin/swag init --parseDependency --parseInternal
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install --legacy-peer-deps
npm run dev
```

App runs at **http://127.0.0.1:5173** and calls `VITE_API_BASE_URL` (default `http://localhost:3030/api/v1`).

## Demo accounts

Seeded when `LOAD_DEMO_DATA=true` (Docker / `setup.sh` default) or when you run `go run . artisan db:seed` / `./scripts/load-demo-data.sh`.

Default password for all demo personas: **`Demo@Moh2026!`**

| Email | Role | Typical use |
|-------|------|-------------|
| `worker@moh.go.ug` | Staff | PPA, reporting, leave, attendance |
| `supervisor@moh.go.ug` | Supervisor | Team approvals, supervision dashboard |
| `depthead@moh.go.ug` | Department head | Department dashboard |
| `hr@moh.go.ug` | HR officer | HR dashboard, leave admin, staff management |
| `director@moh.go.ug` | Director | District-wide dashboard |
| `ps@moh.go.ug` | Permanent secretary | Executive dashboard |
| `admin@moh.go.ug` | Administrator | KPI catalog, RBAC, full admin |

Super admin credentials are env-managed only (`SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in `.env`).

## Authentication & RBAC

JWT authentication with roles, permissions, and iHRIS-based data scoping.

### Login (API)

```bash
curl -X POST http://localhost:3030/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"worker@moh.go.ug","password":"Demo@Moh2026!"}'
```

Use the returned token: `Authorization: Bearer <token>`

### Default roles

| Role | Scope |
|------|-------|
| `staff` | Own records (`staff_id`) |
| `supervisor` | Supervised staff |
| `department_head` | Same `department_id` |
| `hr_officer` | Same `district_id` |
| `director` | District-wide |
| `executive_office` | Organization-wide |
| `admin` | Full access (database-managed) |
| `super_admin` | Bypass all checks (env-managed) |

### Security features

- JWT with blacklist on logout
- Bcrypt password hashing
- Account lockout after failed attempts
- Login rate limiting by IP + email
- Super admin password only via `SUPER_ADMIN_PASSWORD` env
- Route permission guards + data-scope policies

## Web application routes

| Path | Module |
|------|--------|
| `/dashboard` | Role-based dashboard with drilldowns and district map |
| `/performance` | PPA planning and quarterly reporting |
| `/performance/reports` | PPA/quarterly status, Overall Performance Rating scores, Excel/PDF export |
| `/leave` | Leave requests and balances |
| `/out-of-station` | Off-site duty requests |
| `/attendance` | Clock in/out and history |
| `/notifications` | System notifications |
| `/profile` | Profile and signature |
| `/settings` | Preferences, data sources, email, notifications, reporting windows |
| `/admin/leave` | Leave administration (HR) |
| `/admin/staff` | Staff directory and supervisors |
| `/admin/system` | Global system configuration (e.g. iHRIS overwrite) |
| `/admin/kpi` | KPI catalog and assignments |
| `/admin/rbac` | Roles and permissions |

## API overview

Interactive docs: **http://localhost:3030/swagger/index.html**

### Core

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/config` | Public config (branding, thresholds) |
| POST | `/api/v1/ihris/sync` | Sync `ihrisdata` → normalized staff tables |
| GET | `/api/v1/dashboard/*` | Role-specific dashboards |

### Performance (mobile namespace)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/mobile/performance/summary` | PPA status, KPI weights, reporting windows |
| GET | `/api/v1/mobile/performance/kpis/grouped` | Assigned KPIs by subject area |
| POST | `/api/v1/mobile/performance/ppa` | Save performance plan |
| GET | `/api/v1/mobile/performance/report-form` | Quarterly report form |
| POST | `/api/v1/mobile/performance/reports` | Submit quarterly report |
| GET | `/api/v1/mobile/performance/status-report` | Scoped PPA/report status and scores (RBAC) |
| GET | `/api/v1/mobile/performance/overall-rating` | Overall rating for authenticated staff |

**Overall Performance Rating** (aligned with iHRIS end-of-year review):

- Per KPI: `contribution = (actual ÷ target) × weight`
- Period raw score = sum of contributions; normalised = `raw × (100 ÷ total weight)` when weights ≠ 100%
- Overall = average across periods with report entries
- Raw and normalised values are both returned and shown in UI/exports

### Leave

Leave policy is **database-driven** — not hardcoded. HR admins manage types, entitlements, approval stages, and settings via `/api/v1/admin/leave/*`. See [leave.md](leave.md) for policy reference.

### Out of station & attendance

- OOS requests include GPS destination; configurable geofence (default 500 m)
- Attendance clocks verify location against approved OOS destination
- Verification statuses: `verified_oos`, `outside_geofence`, `at_duty_station`

## Database design (normalized)

- **staff** / **staff_contracts** — biodata and deployment from iHRIS
- **staff_supervisors** — up to 3 supervisors with `approval_sequence`
- **districts** — Uganda districts with **map_key** (Highcharts) and **iso_code** for dashboard maps
- **facilities** / **job_titles** / **departments**
- **kpis** / **kpi_assignments** / **ppas** / **ppa_kpis** / **performance_reports**
- **leave_*** / **out_of_station_*** / **attendance_clocks**
- Legacy source (import): `ihrisdata`, `kpi`, `kpi_job_category`

## MoH branding

Primary green `#2E7D32`, accent gold `#F9A825`, background `#F8FAF5`. Typography: Arial/Helvetica per MoH co-branding guidelines.

## Documentation

| Document | Audience |
|----------|----------|
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | End users (staff, supervisors, HR, admins) |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Server deployment: `setup.sh`, Docker, nginx, firewall, TLS |
| [docs/REACT_IMPLEMENTATION_GUIDE.md](docs/REACT_IMPLEMENTATION_GUIDE.md) | Frontend implementation notes |
| [leave.md](leave.md) | Leave policy reference |

## License

Ministry of Health Uganda — internal use.

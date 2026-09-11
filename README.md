# MoH Uganda Performance Management System (PMS)

Integrated performance, leave, attendance, and workforce management platform for the **Ministry of Health Uganda**. The stack pairs **Goravel v1.18** (Go API) with a **React + TypeScript** SPA, **PostgreSQL** by default (MySQL still supported), and **Redis** for caching and sessions.

**User documentation:** [docs/USER_GUIDE.md](docs/USER_GUIDE.md)  
**Deployment guide:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)  
**Doris analytics:** [docs/ANALYTICS.md](docs/ANALYTICS.md)

## Features

| Area | Capabilities |
|------|----------------|
| **Dashboards** | Role-based views; **clickable drilldown tables**; Uganda district choropleth map; **overall performance score** on staff dashboard |
| **Performance** | KPI assignment, PPA planning, quarterly reporting, cumulative (YTD) indicators, **scoped status reports with Excel/PDF export** |
| **Leave** | Self-service requests with **searchable leave type**, multi-stage approval, balances, HR administration |
| **Out of station** | GPS destination requests with supervisor approval and geofenced attendance |
| **Attendance** | Mobile-style clock-in/out with location verification |
| **Approvals** | Unified inbox for leave, out-of-station, and performance reviews |
| **Administration** | Staff directory with **searchable supervisor/department fields**, KPI catalog, leave policy, RBAC, system configuration |
| **Analytics** | **Apache Doris** OLAP (enabled by default) for faster dashboard aggregates; primary OLTP fallback when offline |
| **Appearance** | **Light / dark / system** theme, persisted per browser |
| **Notifications** | In-app alerts for approvals and system events |

## Architecture

```text
performamance_management_system/
├── setup.sh          # Production deployment script (Docker + nginx)
├── scripts/
│   ├── load-demo-data.sh              # Migrate + seed demo data (local backend)
│   ├── migrate-mysql-to-postgres.sh   # Offline MySQL → Postgres cutover
│   └── smoke-postgres-migrate.sh      # Throwaway migrate smoke test
├── backend/          # Goravel v1.18 API
│   └── database/migrations/           # Schema migrations (auto-run on API start)
├── frontend/         # React + Vite + TypeScript SPA
├── deploy/           # Production compose, nginx configs, generated .env
├── database/sql/legacy/01_legacy_source_tables.sql
├── docker-compose.yml
├── docker-compose.analytics.yml   # Apache Doris FE/BE (analytics)
└── docs/
    ├── DEPLOYMENT.md
    ├── USER_GUIDE.md
    ├── ANALYTICS.md
    ├── api/mobile-oos-approvals.md    # Places, OOS, approvals API guide
    └── REACT_IMPLEMENTATION_GUIDE.md
```

**Mobile / integrations API guide:** [docs/api/mobile-oos-approvals.md](docs/api/mobile-oos-approvals.md)  
Interactive Swagger: prefer **`/swagger/index.html`** (see [Migrations & seeding](#migrations--seeding) for port notes).
## Quick Start (development — auto reload)

For day-to-day feature work, use the **dev stack** so Go and React changes apply automatically (no rebuild):

```bash
chmod +x scripts/dev.sh
./scripts/dev.sh
```

| Service  | URL | Reload |
|----------|-----|--------|
| Frontend | http://localhost:5173 | Vite HMR (instant) |
| API      | http://localhost:3030/api/v1 | Air restarts on `.go` changes |
| Swagger  | http://localhost:3030/swagger/index.html | Same as API |

**Without Docker** (API + Vite on your machine, DB in Docker):

```bash
./scripts/dev.sh --local
```

Requires [Air](https://github.com/air-verse/air) (`go install github.com/air-verse/air@latest`).

Stop the dev stack: `./scripts/dev.sh --down`

## Quick Start (Docker + demo data)

Production-style containers (no hot reload — rebuild with `docker compose up --build`):

```bash
docker compose up --build
```

| Service  | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| API      | http://localhost:3030/api/v1 |
| Swagger  | http://localhost:3030/swagger/index.html |
| Postgres | localhost:5433 (`moh_pms` / `pms` / `pms_secret`) — default |
| MySQL    | localhost:3307 (`moh_pms` / `pms` / `pms_secret`) — optional (`--db mysql`) |
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

**Production** (no demo seed — migrate schema only; create admin via seed or cutover data):

```bash
./setup.sh --no-demo-data --admin-password 'YourSecureAdminPass123!'
```

Open **`http://<server-ip>/`** in your browser (append `:PORT` if not using port 80).

| Surface | URL |
|---------|-----|
| Web UI | `http://<host>[:PORT]/` |
| API | `http://<host>[:PORT]/api/v1` |
| Swagger | `http://<host>[:PORT]/swagger/index.html` |

Always open **`/swagger/index.html`**. Bare `/swagger` can 301 to port 80 and break when the gateway listens on **8080/8081**.

After flipping **`DB_CONNECTION`**, see [Migrations & seeding](#migrations--seeding) — use the MySQL→Postgres cutover script or an explicit `db:seed`, not env alone.

### Update an existing server

```bash
cd /path/to/performamance_management_system
git pull
./setup.sh --rebuild          # rebuild images + restart (keeps volumes / DB)
# or, gateway-only after nginx conf changes:
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env --profile app up -d gateway
```

Migrations run automatically on API container start. Demo seed does **not** re-run if `${DATA_DIR}/storage/.initial_seed_complete` exists.

#### Rebuild **with** demo accounts (training / empty Postgres)

`--rebuild` alone does **not** load demo data if `LOAD_DEMO_DATA=false` in `deploy/.env` or if the seed marker file already exists. Production uses **`deploy/.env`**, not `backend/.env`.

```bash
# 1) Clear the one-time seed marker (path = your --data-dir)
rm -f /var/performance_data/storage/.initial_seed_complete

# 2) Rebuild and force demo seed (writes LOAD_DEMO_DATA=true into deploy/.env)
./setup.sh --host 45.10.154.35 --http-port 8081 \
  --data-dir /var/performance_data \
  --demo-data \
  --rebuild
```

Demo logins (password from `ADMIN_PASSWORD`, default `Demo@Moh2026!`):

| Email | Role |
|-------|------|
| `worker@moh.go.ug` | Staff |
| `admin@moh.go.ug` | Admin |
| `hr@moh.go.ug` | HR |

Or seed without a full rebuild:

```bash
rm -f /var/performance_data/storage/.initial_seed_complete
# ensure LOAD_DEMO_DATA=true in deploy/.env
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env --profile app up -d backend
# or:
docker exec moh-pms-api ./moh-pms-api artisan db:seed --force
```

#### Super admin (`SUPER_ADMIN_*`)

`backend/.env` is **local only**. Production reads `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` from **`deploy/.env`** (passed into the API container). If those vars are missing, `EnsureSuperAdmin` is a no-op and `super@moh.go.ug` will not work.

After `git pull` of the wiring fix, set them in `deploy/.env` (or re-run `setup.sh` so they are written), recreate the API, then sign in with that email/password (min 12 characters).

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
Browser → nginx gateway (:80 or :HTTP_PORT)
            ├── /                    → frontend (static React build)
            ├── /api/                → backend (:3030)
            └── /swagger/index.html  → API docs (use full path)
```

## Local Development

### Prerequisites

- Go 1.22+
- Node.js 20+
- PostgreSQL 16 (default) or MySQL 8.x, and Redis (or use Docker for data services only)

### Data services only (Docker)

```bash
# Postgres (default)
docker compose --profile postgres up -d postgres redis

# Or MySQL
docker compose --profile mysql up -d mysql redis
```

Postgres on **localhost:5433**, MySQL on **localhost:3307**, Redis on **localhost:6379**.

### Backend (with demo seed)

```bash
cd backend
cp .env.example .env
# Postgres: DB_CONNECTION=postgres DB_HOST=127.0.0.1 DB_PORT=5433 …
# MySQL:    DB_CONNECTION=mysql DB_HOST=127.0.0.1 DB_PORT=3307 …
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

### Migrations & seeding

Schema changes live in `backend/database/migrations/` and are registered in `backend/bootstrap/migrations.go`.

| Command | What it does |
|---------|----------------|
| `go run . artisan migrate` | Apply pending schema migrations only |
| `go run . artisan db:seed` | RBAC/roles, admin user, configs, catalogs, demo accounts |
| `./scripts/load-demo-data.sh` | Local helper: migrate + seed against your `.env` DB |
| `docker exec moh-pms-api ./moh-pms-api artisan migrate` | Same migrate inside production API container |
| `docker exec moh-pms-api ./moh-pms-api artisan db:seed --force` | Seed once inside production API container |

**Docker / production boot** (`backend/scripts/docker-entrypoint.sh`):

1. Always runs **`migrate`** against the DB from `DB_CONNECTION` (`postgres` default, or `mysql`).
2. Runs **`db:seed`** only when `LOAD_DEMO_DATA=true` **and** the marker `${DATA_DIR}/storage/.initial_seed_complete` is absent.
3. If `LOAD_DEMO_DATA=false` (typical production via `./setup.sh --no-demo-data`), you get **schema only** — no users/roles until you seed or import data.

#### Switching MySQL → Postgres (production)

**Changing `DB_CONNECTION=postgres` alone does not copy MySQL data and does not re-seed.** Use the cutover script while MySQL still has the live data:

```bash
# Optional dry-run (stops app containers in real runs; dry-run exits early)
./scripts/migrate-mysql-to-postgres.sh --dry-run

# Offline cutover: stop app → migrate schema on Postgres → pgloader → flip deploy/.env
./scripts/migrate-mysql-to-postgres.sh

# If a previous attempt left schema/data on Postgres:
./scripts/migrate-mysql-to-postgres.sh --force
```

Then bring the app back (script prints the compose command; or `./setup.sh --rebuild`).

| Goal | What to run |
|------|-------------|
| Keep existing MySQL data | `./scripts/migrate-mysql-to-postgres.sh` (schema + **pgloader**) |
| Fresh Postgres + demo/admin seed | `rm -f "${DATA_DIR:-/var/lib/moh-pms}/storage/.initial_seed_complete"`, set `LOAD_DEMO_DATA=true`, recreate backend — or `docker exec moh-pms-api ./moh-pms-api artisan db:seed --force` |
| Force re-seed after a wipe | Remove the seed marker, then restart with `LOAD_DEMO_DATA=true` |

Verify after cutover/seed:

```bash
docker exec moh-pms-postgres psql -U pms -d moh_pms -c 'SELECT COUNT(*) FROM users;'
grep DB_CONNECTION deploy/.env
```

More detail: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (Database backups + MySQL → PostgreSQL cutover).

#### Swagger

Regenerate after API changes:

```bash
cd backend
~/go/bin/swag init --parseDependency --parseInternal
```

Open **`/swagger/index.html`**. On non-80 ports (e.g. `http://45.x.x.x:8081/swagger/index.html`) do not rely on bare `/swagger`.

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
| `/approvals` | Unified leave / OOS / performance approval inbox |
| `/performance` | PPA planning and quarterly reporting |
| `/performance/reports` | PPA/quarterly status, Overall Performance Rating scores, Excel/PDF export |
| `/leave` | Leave requests and balances |
| `/out-of-station` | Off-site duty requests |
| `/attendance` | Clock in/out and history |
| `/notifications` | System notifications |
| `/profile` | Profile and signature |
| `/settings` | Preferences (incl. appearance), data sources, Doris analytics, email, notifications |
| `/admin/leave` | Leave administration (HR) |
| `/admin/staff` | Staff directory and supervisors |
| `/admin/system` | Global system configuration (e.g. iHRIS overwrite) |
| `/admin/kpi` | KPI catalog and assignments |
| `/admin/rbac` | Roles and permissions |

## Appearance (dark mode)

The UI supports **Light**, **Dark**, and **System** themes:

- Header **moon/sun** toggle (next to notifications) — switches light ↔ dark
- Account menu → **Appearance**, or **Settings → Preferences → Appearance**
- Preference is stored in the browser (`localStorage`) and applied on load (no flash)

## Analytics (Apache Doris)

Doris is **enabled by default** for OLAP reads. Start the FE/BE stack when you want live analytics acceleration:

```bash
docker compose -f docker-compose.analytics.yml up -d
```

Full guide: **[docs/ANALYTICS.md](docs/ANALYTICS.md)**.

## API overview

Interactive docs: **http://localhost:3030/swagger/index.html** (also `/swagger/index.html` behind the production gateway)

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
- Mobile API guide (places + OOS lifecycle + approvals): **[docs/api/mobile-oos-approvals.md](docs/api/mobile-oos-approvals.md)**
- Interactive docs: **http://localhost:3030/swagger/index.html**

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
| [docs/api/mobile-oos-approvals.md](docs/api/mobile-oos-approvals.md) | Mobile places, OOS lifecycle, approvals API |
| [leave.md](leave.md) | Leave policy reference |

## License

Ministry of Health Uganda — internal use.

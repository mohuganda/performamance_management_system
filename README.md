# MoH Uganda Performance Management System (PMS - iHRIS)

Integrated performance management platform for the Ministry of Health Uganda. The stack pairs **Goravel v1.18** (Go API) with a **React + TypeScript** frontend, **MySQL** (extracted legacy tables + normalized PMS schema), and **Redis** for caching and sessions.

## Architecture

```text
performamance_management_system/
├── backend/          # Goravel v1.18 API
├── frontend/         # React + Vite + TypeScript SPA
├── database/sql/legacy/01_legacy_source_tables.sql  # ihrisdata, kpi, kpi_job_category only
├── docker-compose.yml
└── docs/
    └── REACT_IMPLEMENTATION_GUIDE.md
```

## Authentication & RBAC

Multi-layered JWT authentication with roles, permissions, and iHRIS-based data scoping.

### Setup

```bash
cd backend
./artisan jwt:secret
# Set in .env:
# SUPER_ADMIN_EMAIL=...
# SUPER_ADMIN_PASSWORD=...   (min 12 chars, env-managed only)
# ADMIN_EMAIL=admin@moh.go.ug
# ADMIN_PASSWORD=...         (database admin, min 10 chars)

go run . artisan migrate
go run . artisan db:seed --seeder=RbacSeeder
```

### Login

```bash
curl -X POST http://localhost:3030/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@moh.go.ug","password":"your-password"}'
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
- Route permission guards + Gate model policies for data scope

### Admin RBAC API

| Method | Endpoint |
|--------|----------|
| GET | `/api/v1/admin/rbac/roles` |
| GET | `/api/v1/admin/rbac/permissions` |
| POST | `/api/v1/admin/rbac/users` |
| POST | `/api/v1/admin/rbac/users/{id}/roles` |
| POST | `/api/v1/admin/rbac/roles/{id}/scopes` |
| POST | `/api/v1/admin/rbac/roles/{code}/permissions` |

## Quick Start (Docker)

```bash
docker compose up --build
```

| Service  | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| API      | http://localhost:3030/api/v1 |
| Swagger  | http://localhost:3030/swagger/index.html |
| MySQL    | localhost:3307 (`moh_pms`) |
| Redis    | localhost:6379 |

## Local Development

### Backend

```bash
cd backend
cp .env.example .env
go run . artisan key:generate
go run . artisan migrate
go run . artisan db:seed --seeder=PmsSeeder
go run . artisan db:seed --seeder=LeaveConfigSeeder
go run . artisan db:seed --seeder=AttendanceModuleSeeder
go run .
```

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

### Sync demo iHRIS data

Docker loads only the extracted legacy tables (`ihrisdata`, `kpi`, `kpi_job_category`) — not the full `npm_dashboard (3).sql` dump.

```bash
curl -X POST http://localhost:3030/api/v1/ihris/sync
```

## API Endpoints

### Core

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/config` | Server-side public config (branding, thresholds, roles) |
| POST | `/api/v1/ihris/sync` | Sync `ihrisdata` → normalized staff/facility/job tables |
| GET | `/api/v1/dashboard/health-worker` | Health worker dashboard |
| GET | `/api/v1/dashboard/supervisor` | Supervisor dashboard |
| GET | `/api/v1/dashboard/department-head` | Department head dashboard |
| GET | `/api/v1/dashboard/hr-manager` | HR manager dashboard |

### Mobile self-service (leave, out-of-station, attendance)

All mobile endpoints use `X-Staff-Id` header for the authenticated employee (JWT to be added).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/mobile/leave/types` | Leave types |
| GET | `/api/v1/mobile/leave/balances` | Leave balances for staff |
| GET | `/api/v1/mobile/leave/requests` | My leave requests |
| POST | `/api/v1/mobile/leave/requests` | Create/submit leave request |
| POST | `/api/v1/mobile/leave/approvals/{id}` | Supervisor approve/reject leave |
| GET | `/api/v1/mobile/out-of-station/reasons` | OOS reasons |
| GET | `/api/v1/mobile/out-of-station/requests` | My OOS requests |
| POST | `/api/v1/mobile/out-of-station/requests` | Create/submit OOS request (with map coordinates) |
| POST | `/api/v1/mobile/out-of-station/approvals/{id}` | Supervisor approve/reject OOS |
| POST | `/api/v1/mobile/attendance/clock` | GPS clock-in/out (verified against approved OOS destination) |
| GET | `/api/v1/mobile/attendance/clocks` | My attendance history |

Interactive API docs: **http://localhost:3030/swagger/index.html**

## Modules

### Leave (`leave.md`) — database-driven

Leave policy is **not hardcoded**. HR admins manage configuration via API; mobile and web clients read from the database.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/mobile/leave/config` | Full leave config (settings, types, entitlements, stages) |
| GET | `/api/v1/admin/leave/settings` | Global leave policy settings |
| PUT | `/api/v1/admin/leave/settings` | Update settings (advance notice, work hours, carry-over, etc.) |
| GET/POST | `/api/v1/admin/leave/types` | Manage leave types |
| PUT/DELETE | `/api/v1/admin/leave/types/{id}` | Update or deactivate a leave type |
| GET/POST | `/api/v1/admin/leave/entitlements` | Entitlements by salary grade |
| PUT/DELETE | `/api/v1/admin/leave/entitlements/{id}` | Update or delete entitlement |
| GET/POST | `/api/v1/admin/leave/approval-stages` | Approval workflow stages |
| PUT | `/api/v1/admin/leave/approval-stages/{id}` | Update approval stage |

Configurable items stored in DB:

- **`system_configs`** (group `leave`) — advance notice days, work hours, carry-over deadline, clock window
- **`leave_types`** — name, code, max days, medical report rules, per-type advance notice, eligibility notes
- **`leave_entitlements`** — days per year by salary grade (U2–U8)
- **`leave_approval_stages`** — employee → supervisor → responsible officer → HR

Seed initial MoH defaults: `go run . artisan db:seed --seeder=LeaveConfigSeeder`

### Leave (employee flow)

- Leave types, entitlements by salary grade (U2–U8)
- Sequential supervisor approval (up to 3 supervisors per contract)
- Advance notice and medical report rules enforced from DB config

### Out-of-station

Modeled on the legacy attend system (`/attend/requests/newRequest`):

- Date range, reason, remarks, attachment
- **Destination** with latitude/longitude (Google Maps or any map picker)
- Configurable geofence radius (default 500 m)
- Sequential supervisor approval

### Attendance clocking

- `attendance_clocks` table stores GPS clock events
- When staff has an approved OOS request for the day, clock position is compared to destination using Haversine distance
- Verification statuses: `verified_oos`, `outside_geofence`, `at_duty_station`

## Database Design (Normalized)

- **staff** — biodata (from iHRIS `ihris_pid`, names, contacts)
- **staff_contracts** — deployment details; `contract_status`: `active` / `ended`
- **staff_supervisors** — up to 3 supervisors with `approval_sequence` (1 = first approver)
- **facilities** — includes `nfrid` (National Facility Registry ID)
- **job_titles** — normalized from iHRIS / `kpi_job_category`
- **leave_requests** / **leave_approvals** / **leave_entitlements** / **leave_balances**
- **out_of_station_requests** / **out_of_station_approvals** — with GPS destination
- **attendance_clocks** — mobile GPS clock events

Legacy source tables (read-only import): `ihrisdata`, `kpi`, `kpi_job_category`

## MoH Branding

Primary green `#2E7D32`, accent gold `#F9A825`, background `#F8FAF5`. Typography: Arial/Helvetica per MoH co-branding guidelines.

## Documentation

See [docs/REACT_IMPLEMENTATION_GUIDE.md](docs/REACT_IMPLEMENTATION_GUIDE.md) for the full React implementation prompt and module roadmap.

# Places Cache + Mobile OOS/Approvals API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Local-first immutable place cache (DB) with Google fallback, view-only admin browse + facility seed job, and a full documented mobile OOS/approvals API contract.

**Architecture:** Backend `GET /places/search` queries `cached_places` first (country from Settings), calls Google Places (New) only on miss, inserts only when not duplicate. Facility seed copies snapshots (no live FK). OOS mobile gains get/update/submit/cancel; Swagger + markdown guide document approvals and places.

**Tech Stack:** Goravel/Go, Postgres, React, TanStack Query, Google Places API (New) server-side, swaggo.

**Spec:** `docs/superpowers/specs/2026-09-11-places-cache-mobile-oos-approvals-design.md`

## Global Constraints

- Cached place identity fields are **immutable** after insert (no name/coords updates; facility changes must not rewrite cache).
- If a place already exists (dedupe rules), **do not insert**.
- Admin locations UI is **view-only** (no edit/delete).
- Country scope from `google_maps.country_code` (e.g. `ug`).
- Local-first search; Google only when local results are insufficient.
- Do not commit unless the user explicitly asks.
- Preserve existing OOS approve + approvals inbox behavior.

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/database/migrations/20260911000003_cached_places.go` | `cached_places` table |
| `backend/bootstrap/migrations.go` | Register migration |
| `backend/app/models/pms.go` | `CachedPlace` model |
| `backend/app/services/places_service.go` | Search, dedupe, insert, seed |
| `backend/app/services/places_dedupe_test.go` | Unit tests for normalize/dedupe helpers |
| `backend/app/services/google_places_client.go` | Server-side Places API (New) calls |
| `backend/app/http/controllers/places_controller.go` | Search + get-by-id |
| `backend/app/http/controllers/places_admin_controller.go` | Admin list + seed trigger |
| `backend/routes/api.go` | Wire places + OOS lifecycle routes |
| `backend/app/services/out_of_station_service.go` | Get/UpdateDraft/Submit/Cancel |
| `backend/app/http/controllers/mobile_controller.go` | OOS lifecycle handlers + swagger |
| `frontend/src/api/services/places.ts` | Call backend search |
| `frontend/src/components/molecules/PlaceAutocompleteField.tsx` | Use backend (drop direct Google search) |
| `frontend/src/api/services/listsAdmin.ts` + `ListsAdminPanel.tsx` | Cached places view-only tab |
| `frontend/src/api/services/mobile.ts` | OOS get/update/submit/cancel client |
| `docs/api/mobile-oos-approvals.md` | Mobile API guide |
| `backend/docs/*` | Regenerated swagger |

---

### Task 1: `cached_places` migration + model + dedupe helpers

**Files:**
- Create: `backend/database/migrations/20260911000003_cached_places.go`
- Modify: `backend/bootstrap/migrations.go`
- Modify: `backend/app/models/pms.go`
- Create: `backend/app/services/places_dedupe.go` (or top of `places_service.go`)
- Create: `backend/app/services/places_dedupe_test.go`

**Interfaces:**
- Produces:

```go
type CachedPlace struct {
  // ID, Name, Address *string, Latitude, Longitude float64
  // CountryCode, GooglePlaceID *string, NormalizedName string
  // Source, SourceRef *string, HitCount int, LastHitAt *time.Time
}

func NormalizePlaceName(name string) string
func PlaceCoordsNear(lat1, lng1, lat2, lng2, meters float64) bool
```

- [ ] **Step 1: Failing tests**

```go
func TestNormalizePlaceName(t *testing.T) {
  if NormalizePlaceName("  Mulago  Hospital ") != "mulago hospital" {
    t.Fatal()
  }
}

func TestPlaceCoordsNear(t *testing.T) {
  // same point → true; ~1km apart → false for 50m threshold
}
```

- [ ] **Step 2: Run — expect FAIL**

`go test ./app/services -run 'TestNormalizePlaceName|TestPlaceCoordsNear' -v`

- [ ] **Step 3: Migration + model + helpers**

Create table `cached_places` with columns from the spec; unique index on `google_place_id` where not null (Postgres partial unique if supported; else unique nullable handling). Register migration. Implement helpers using existing haversine pattern from `attendance_service.go`.

- [ ] **Step 4: Run tests — PASS**

`go test ./app/services -run 'TestNormalizePlaceName|TestPlaceCoordsNear' -v`  
`go build -o /dev/null .`

---

### Task 2: Places service — local search, Google fallback, insert-if-new

**Files:**
- Create: `backend/app/services/google_places_client.go`
- Create: `backend/app/services/places_service.go`
- Create: `backend/app/http/controllers/places_controller.go`
- Modify: `backend/routes/api.go`

**Interfaces:**
- Produces:

```go
func (s *PlacesService) Search(q string, countryCodes []string, limit int) ([]CachedPlace, error)
func (s *PlacesService) GetByID(id uint) (*CachedPlace, error)
func (s *PlacesService) InsertIfNew(place CachedPlace) (CachedPlace, bool, error) // bool = inserted
func (s *PlacesService) ResolveCountryCodes() []string // from settings google_maps.country_code
```

- Consumes: Settings `google_maps.api_key`, `google_maps.country_code`; helpers from Task 1.

- [ ] **Step 1: Implement `InsertIfNew` + local query**

Dedupe order: `google_place_id` → normalized_name+country+within 50m. Never update identity fields. Allow bumping `hit_count`/`last_hit_at` only.

- [ ] **Step 2: Google client**

Server-side `places.googleapis.com/v1/places:autocomplete` + place details (same approach as `frontend/src/api/services/places.ts`). Use API key from settings. Map predictions → lat/lng/name/address/`google_place_id`.

- [ ] **Step 3: `Search` flow**

1. Local `ILIKE` / `normalized_name` prefix, country filter, limit 15.  
2. If ≥1 result, return local (optionally bump hits).  
3. Else Google → for each resolved place `InsertIfNew` → return merged (prefer returning newly cached + any weak local).

- [ ] **Step 4: HTTP**

```go
// GET /api/v1/places/search?q=&country=   auth
// GET /api/v1/places/{id}                 auth
```

Register under authenticated group in `routes/api.go`.

- [ ] **Step 5: Verify**

`go build -o /dev/null .`  
Manual: with seed empty, search once (Google), second identical search hits DB only (logs/hit_count).

---

### Task 3: Facility seed job + admin view-only UI

**Files:**
- Modify: `backend/app/services/places_service.go` — `SeedFromFacilities() (inserted, skipped int, error)`
- Create/Modify: admin controller + `GET /admin/lists/cached-places`, `POST /admin/lists/cached-places/seed`
- Modify: `frontend/src/api/services/listsAdmin.ts`
- Modify: `frontend/src/modules/settings/ListsAdminPanel.tsx`

**Interfaces:**
- Seed: for each facility with name + lat/lng, insert snapshot `source=facility_seed`, `source_ref=facility:{id}`, `country_code` from settings (default `ug`). Idempotent via `InsertIfNew`.

- [ ] **Step 1: Seed method**

Do not UPDATE existing rows when facility later changes. Re-run only inserts missing.

- [ ] **Step 2: Admin list API**

Paginated list: search, filter `source`, `country_code`. Read-only — no PUT/DELETE.

- [ ] **Step 3: Lists UI tab `cached-places`**

View-only `ServerPaginatedTable` + button **Seed from facilities** calling seed endpoint. No edit forms.

- [ ] **Step 4: Wire frontend places client**

Update `frontend/src/api/services/places.ts` to call `/places/search` via `apiClient` (auth). Update `PlaceAutocompleteField` to use backend results (keep Maps script only if still needed for other UI; remove direct Places REST from browser).

- [ ] **Step 5: Verify**

Seed → facilities appear in admin list. Change a facility name in admin lists → cached row unchanged. OOS/Profile autocomplete still works.

---

### Task 4: OOS mobile lifecycle API

**Files:**
- Modify: `backend/app/services/out_of_station_service.go`
- Modify: `backend/app/http/controllers/mobile_controller.go`
- Modify: `backend/routes/api.go`
- Modify: `frontend/src/api/services/mobile.ts` (`oosService`)

**Interfaces:**
- Produces service methods:

```go
GetOwned(staffID, id uint) (*OutOfStationRequest, error)
UpdateDraft(staffID, id uint, input CreateOutOfStationInput) (OutOfStationRequest, error)
Submit(id, staffID uint) error // may already exist
Cancel(staffID, id uint) error // draft or pending per existing status rules
```

- Optional body field `cached_place_id` on create/update — if set, copy snapshot name/lat/lng into destination fields (still store destination columns; do not FK-update from cache later).

- [ ] **Step 1: Service methods**

Enforce owner + status: update only `draft`; cancel when `draft` or `pending`/`submitted` as consistent with leave cancel patterns; submit transitions draft → pending and seeds approvals (reuse existing `Submit`).

- [ ] **Step 2: Controllers + routes**

| Method | Path |
|--------|------|
| GET | `/mobile/out-of-station/requests/{id}` |
| PUT | `/mobile/out-of-station/requests/{id}` |
| POST | `/mobile/out-of-station/requests/{id}/submit` |
| POST | `/mobile/out-of-station/requests/{id}/cancel` |

Keep existing create/list/pending/approve.

- [ ] **Step 3: Frontend `oosService` methods** for the new endpoints (web can keep current UX; methods enable mobile parity).

- [ ] **Step 4: Verify**

`go build -o /dev/null .`  
API smoke: create draft → get → update → submit → pending → approve.

---

### Task 5: Swagger + markdown API guide

**Files:**
- Modify: godoc on mobile OOS + approvals + places handlers
- Regenerate: `cd backend && swag init --parseDependency --parseInternal` (or project’s documented command)
- Create: `docs/api/mobile-oos-approvals.md`
- Modify: `README.md` or `docs/DEPLOYMENT.md` — link to Swagger + guide

**Interfaces:**
- Guide sections: Auth bearer, staff linkage, Places search, OOS lifecycle examples, Approvals inbox/detail/act, error shapes.

- [ ] **Step 1: Annotate new endpoints** (Summary, Params, Success, Router, Security).

- [ ] **Step 2: Regenerate swagger artifacts** under `backend/docs/`.

- [ ] **Step 3: Write `docs/api/mobile-oos-approvals.md` with curl examples for places search, OOS create/submit/approve, inbox.

- [ ] **Step 4: Verify**

Open `/swagger/index.html` — places + OOS lifecycle visible. Guide links resolve.

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| `cached_places` + immutability | Task 1–2 |
| Local-first + Google + no dup insert | Task 2 |
| Facility seed snapshots | Task 3 |
| Admin view-only | Task 3 |
| Frontend uses backend places | Task 3 |
| Full OOS mobile contract | Task 4 |
| Approvals docs + swagger | Task 5 |

## Placeholder / consistency review

- Country key: `google_maps.country_code`.
- Sources: `facility_seed` \| `google` \| `user_select`.
- Dedupe: place_id OR name+country+~50m.
- No admin edit/delete endpoints.

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-11-places-cache-mobile-oos-approvals.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh agent per task, review between tasks  
2. **Inline Execution** — implement in this session with checkpoints  

Which approach?

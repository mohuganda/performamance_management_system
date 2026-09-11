# Places Cache + Mobile OOS/Approvals API Design

**Date:** 2026-09-11  
**Status:** Approved for implementation (Approach A)  
**Settings:** `/settings?tab=data-sources` → Country restriction (e.g. `ug`)  
**Related surfaces:** OOS destination picker, Profile duty-station picker, Approvals, Swagger `/swagger`

## Problem

1. Place search hits Google Places directly from the browser on every keystroke/select. There is no shared DB cache, no backend locations API for mobile, and no admin visibility into accumulated places.
2. Mobile clients need a **full** OOS + approvals HTTP contract (lifecycle + docs). Approve endpoints exist but the lifecycle and Swagger coverage are incomplete.

## Goals

### Places (Workstream 1)

1. Store places in Postgres (`cached_places`) as **immutable** snapshots.
2. Search is **local-first**; call Google only when no suitable local match.
3. On Google/select success, **insert only if the place does not already exist** (no updates to name/coords).
4. Hybrid seed: one-shot/job copies **facility snapshots** into the cache; later facility changes must **not** rewrite cached rows.
5. Admin **view-only** screen to browse/search cached places (filter by country/source).
6. Public authenticated `GET /api/v1/places/search` (and details if needed) used by web + mobile; country from `google_maps.country_code`.

### OOS + Approvals API (Workstream 2)

1. Full mobile contract for out-of-station: reasons, create/update draft, get-by-id, submit, cancel, list mine, pending, approve/reject.
2. Document unified approvals inbox/detail + leave/OOS approve paths in Swagger and a short markdown guide.
3. Fill thin gaps so a mobile app can complete OOS without the web UI.

## Non-goals

- Bulk download of “all places in Uganda” from Google (not supported by the API).
- Admin edit/delete of cached places (view-only).
- Live foreign key from `cached_places` → `facilities` that syncs on facility update.
- Replacing Maps JS map rendering (only search/details move behind the backend proxy).
- Changing leave/OOS business rules beyond API surface completeness.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Places architecture | Backend proxy + immutable DB cache (Approach A) |
| Seed strategy | Hybrid: facility snapshots + organic search/select inserts |
| Facility linkage | Snapshot only — immutable; facility changes do not affect cache |
| Duplicates | If place exists, do not insert |
| Admin locations UI | View-only (search/filter/paginate) |
| OOS/approvals API | Full mobile contract + docs (option 3) |
| Country scope | `google_maps.country_code` (comma-separated ISO codes, e.g. `ug`) |

---

## Workstream 1 — Places cache

### 1. Data model

Table `cached_places`:

| Column | Type | Notes |
|--------|------|--------|
| `id` | PK | |
| `name` | string | Display name (immutable after insert) |
| `address` | string, nullable | Formatted address |
| `latitude` | float | Required |
| `longitude` | float | Required |
| `country_code` | string(2) | Lowercase ISO, e.g. `ug` |
| `google_place_id` | string, nullable, unique where not null | Dedupe key when from Google |
| `normalized_name` | string | Lowercased/trimmed name for local match |
| `source` | string | `facility_seed` \| `google` \| `user_select` |
| `source_ref` | string, nullable | e.g. `facility:123` at seed time only (informational, not FK) |
| `hit_count` | int, default 0 | Optional analytics; incrementing hit_count is allowed (metadata only, not place identity) |
| `last_hit_at` | timestamp, nullable | Metadata only |
| `created_at` / `updated_at` | timestamps | `updated_at` only for hit_count metadata if needed |

**Immutability rule:** Never UPDATE `name`, `address`, `latitude`, `longitude`, `google_place_id`, `country_code`, `source`, `source_ref` after insert. No DELETE in product flows.

### 2. Dedupe

A place **exists** (skip insert) if any of:

1. `google_place_id` matches (when present), or  
2. Same `country_code` + `normalized_name` + coordinates within ~50 m (haversine), or  
3. Same `country_code` + `normalized_name` when lat/lng both within ~50 m of an existing row.

### 3. Search API

`GET /api/v1/places/search?q=&country=` (auth required)

1. Resolve country codes: query param override or Settings `google_maps.country_code` (default `ug`).
2. Query `cached_places` with `ILIKE` / prefix on `normalized_name` or `name`/`address`, filtered by country, limit ~10–20.
3. If local results sufficient (e.g. ≥1 strong match or ≥N results), return them with `source: local`.
4. Else call Google Places API (New) autocomplete (+ details as needed) server-side using stored API key.
5. For each Google result resolved to lat/lng: try insert (dedupe); return combined list (local first, then new).
6. Optionally bump `hit_count` / `last_hit_at` on returned local rows (metadata only).

`GET /api/v1/places/{id}` — return cached place by id (for mobile).

Frontend: change `places.ts` / `PlaceAutocompleteField` to call backend instead of Google directly. Map script may still load for map UI only.

### 4. Seed job

Artisan/console command (and optional admin trigger): `places:seed-from-facilities`

- For each facility with usable name + lat/lng (and country in configured codes, or all UG facilities): insert snapshot if not duplicate.
- `source = facility_seed`, `source_ref = facility:{id}` at insert time only.
- Re-running is idempotent (dedupe skips existing).
- Does **not** update rows when facility name/coords later change.

### 5. Admin UI (view-only)

Under Settings → Lists (or Data sources adjacent): **Cached places**

- Server-paginated table: name, address, coords, country, source, created_at, hit_count
- Search + filters: country, source
- Actions: **none** for edit/delete (view only); optional “Run facility seed job” button for admins with data-sources/lists permission

### 6. Permissions

- Search/detail: any authenticated user (same as using OOS/profile pickers today).
- Admin list + seed trigger: reuse `settings.data_sources.manage` or lists admin permission (pick one; default lists/data_sources manage).

---

## Workstream 2 — Mobile OOS + approvals API

### 1. Out-of-station lifecycle

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/mobile/out-of-station/reasons` | Active reasons (exists) |
| GET | `/mobile/out-of-station/requests` | My requests (exists) |
| GET | `/mobile/out-of-station/requests/{id}` | **Add** get-by-id (owner or approver) |
| POST | `/mobile/out-of-station/requests` | Create draft / optional submit (exists) |
| PUT/PATCH | `/mobile/out-of-station/requests/{id}` | **Add** update draft (owner, status draft) |
| POST | `/mobile/out-of-station/requests/{id}/submit` | **Add** submit draft |
| POST | `/mobile/out-of-station/requests/{id}/cancel` | **Add** cancel when allowed |
| GET | `/mobile/out-of-station/pending-approvals` | Exists |
| POST | `/mobile/out-of-station/approvals/{id}` | Approve/reject (exists) |

Destination fields may reference `cached_place_id` optionally while still accepting lat/lng/name for backward compatibility.

### 2. Approvals (unified)

Keep and document:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/mobile/approvals/inbox` | Pending + history |
| GET | `/mobile/approvals/detail?module=&id=` | Detail + trail |
| POST | `/mobile/leave/approvals/{id}` | Leave decision |
| POST | `/mobile/out-of-station/approvals/{id}` | OOS decision |
| POST | `/mobile/performance/...` | Existing PPA/appraisal reviews |

Ensure responses use consistent snake_case DTOs where the web already normalized PascalCase issues.

### 3. Documentation

1. Swagger godoc on all new/updated mobile endpoints; regenerate `swag init`.
2. Markdown guide: `docs/api/mobile-oos-approvals.md` — auth, permissions/staff linkage, request/response examples, error shapes, places search usage for destinations.
3. Link from `docs/DEPLOYMENT.md` or README API section to Swagger + the guide.

---

## Spec coverage checklist

| Requirement | Section |
|-------------|---------|
| DB cache | WS1 §1 |
| Local-first then Google | WS1 §3 |
| Immutable; facility changes isolated | WS1 §1, §4 |
| No insert if exists | WS1 §2 |
| Admin view-only | WS1 §5 |
| Country from admin (`ug`) | WS1 §3, Decisions |
| Seed job hybrid | WS1 §4 |
| Places API for web + mobile | WS1 §3 |
| Full OOS mobile contract | WS2 §1 |
| Approvals via API + docs | WS2 §2–3 |

## Out of scope follow-ups

- Soft-disable / archive flag for places (not required while view-only and no deletes).
- Rate limiting Google fallback beyond sensible per-user throttling.
- Native mobile app UI (API-only in this project).

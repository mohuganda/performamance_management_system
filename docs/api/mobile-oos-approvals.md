# Mobile API — Places, Out-of-station & Approvals

Guide for mobile (and web) clients integrating place search, out-of-station (OOS) request lifecycle, and the unified approvals inbox.

Interactive OpenAPI: `/swagger/index.html` (local API typically `http://localhost:3030/swagger/index.html`).

Base path: `/api/v1`

---

## Auth

1. `POST /api/v1/auth/login` with email/password (and TOTP if enrolled).
2. Send `Authorization: Bearer <access_token>` on subsequent calls.
3. The user account must be **linked to a staff record**. Endpoints that need staff return **403** with:

```json
{ "message": "authenticated user is not linked to a staff record" }
```

Useful permissions (role-dependent):

| Area | Permission keys |
|------|-----------------|
| Places search | Authenticated user |
| OOS list / get | `oos.requests.view` |
| OOS create / update / submit / cancel | `oos.requests.create` |
| Attendance clock | `attendance.clock` |
| Approvals inbox | Linked staff (authorization checked in-service) |

---

## Places (local-first cache)

Country scope comes from Settings `google_maps.country_code` (e.g. `ug`). Search hits Postgres `cached_places` first; Google Places (New) runs only on cache miss. Cache rows are **immutable** snapshots (facility renames do not rewrite existing rows).

### Search

```bash
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$API/places/search?q=mulago&country=ug"
```

Example item:

```json
{
  "id": 12,
  "name": "Mulago National Referral Hospital",
  "address": "Kampala",
  "latitude": 0.337,
  "longitude": 32.576,
  "country_code": "ug",
  "source": "facility_seed",
  "hit_count": 3
}
```

### Get by id

```bash
curl -sS -H "Authorization: Bearer $TOKEN" "$API/places/12"
```

### Admin (view-only)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/admin/lists/cached-places` | Paginated; `search`, `source`, `country_code` |
| POST | `/admin/lists/cached-places/seed` | Snapshot facilities with lat/lng into cache |

No edit/delete endpoints.

---

## Out-of-station lifecycle

Destination may be sent as lat/lng/name **or** `cached_place_id` (server copies the immutable snapshot into destination columns).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/mobile/out-of-station/reasons` | Active travel reasons |
| GET | `/mobile/out-of-station/requests` | My requests |
| GET | `/mobile/out-of-station/requests/{id}` | Owner or assigned approver |
| POST | `/mobile/out-of-station/requests` | Create draft (`submit: true` optional) |
| PUT | `/mobile/out-of-station/requests/{id}` | Update **draft** only |
| POST | `/mobile/out-of-station/requests/{id}/submit` | Draft → pending + seed approvals |
| POST | `/mobile/out-of-station/requests/{id}/cancel` | Cancel **draft** or **pending** |
| GET | `/mobile/out-of-station/pending-approvals` | Approver queue |
| POST | `/mobile/out-of-station/approvals/{id}` | Approve / reject |

### Create draft

```bash
curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "reason_id": 1,
    "start_date": "2026-09-20",
    "end_date": "2026-09-22",
    "expected_deliverables": "Field supervision report",
    "cached_place_id": 12,
    "geofence_radius_meters": 500,
    "submit": false
  }' \
  "$API/mobile/out-of-station/requests"
```

Or with explicit coordinates (no `cached_place_id`):

```json
{
  "reason_id": 1,
  "start_date": "2026-09-20",
  "end_date": "2026-09-22",
  "expected_deliverables": "Field supervision report",
  "destination_name": "District Health Office",
  "destination_address": "Gulu",
  "destination_latitude": 2.774,
  "destination_longitude": 32.299,
  "submit": true
}
```

### Update → submit → cancel

```bash
# Update draft
curl -sS -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{ ...same fields as create without submit... }' \
  "$API/mobile/out-of-station/requests/42"

# Submit
curl -sS -X POST -H "Authorization: Bearer $TOKEN" \
  "$API/mobile/out-of-station/requests/42/submit"

# Cancel (draft or pending)
curl -sS -X POST -H "Authorization: Bearer $TOKEN" \
  "$API/mobile/out-of-station/requests/42/cancel"
```

Statuses: `draft` → `pending` → `approved` / `rejected`, or `cancelled`.

### Approve / reject

```bash
curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"approve": true, "comments": "OK"}' \
  "$API/mobile/out-of-station/approvals/7"
```

---

## Unified approvals

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/mobile/approvals/inbox` | Pending + history across modules |
| GET | `/mobile/approvals/detail?module=&id=` | Detail + trail |
| POST | `/mobile/leave/approvals/{id}` | Leave decision |
| POST | `/mobile/out-of-station/approvals/{id}` | OOS decision |

```bash
curl -sS -H "Authorization: Bearer $TOKEN" "$API/mobile/approvals/inbox"

curl -sS -H "Authorization: Bearer $TOKEN" \
  "$API/mobile/approvals/detail?module=out_of_station&id=42"
```

`module` values include `leave`, `out_of_station`, and performance modules as returned by the inbox.

---

## Error shapes

Most failures return JSON:

```json
{ "message": "human-readable reason" }
```

| HTTP | Typical meaning |
|------|-----------------|
| 400 | Invalid body / path / dates |
| 403 | Not authenticated or not linked to staff |
| 404 | Request/place not found (or not visible) |
| 422 | Business rule (wrong status, validation, missing supervisors) |
| 500 | Unexpected server error |

---

## Attendance note

Clock-in/out with GPS: `POST /mobile/attendance/clock`. For OOS days, pass `out_of_station_request_id` explicitly when clocking against an approved destination; the server scores distance vs geofence radius.

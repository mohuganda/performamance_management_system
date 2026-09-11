# Attendance OOS Map + Accuracy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let employees clock at station by default, or select an approved OOS request, see clocks on a map vs destination, and flag accuracy below a configurable % threshold.

**Architecture:** Extend `AttendanceService.Clock` to accept optional `OutOfStationRequestID` (no silent auto-attach). Score `accuracy% = max(0,(1-distance/radius)*100)` against admin threshold. Attendance UI adds mode toggle + request select + Google Map. Settings live under Data sources.

**Tech Stack:** Goravel/Go, React, TanStack Query, Google Maps JS (existing key), system_configs.

**Spec:** `docs/superpowers/specs/2026-09-11-attendance-oos-map-accuracy-design.md`

## Global Constraints

- Default mode: At duty station (no request).
- OOS clocks require explicit approved `out_of_station_request_id`.
- Flag when accuracy % &lt; `oos.attendance.min_accuracy_percent` (default 70).
- Percentage is the primary score; miles/meters are secondary labels.
- Do not commit unless the user explicitly asks.
- Preserve existing Google Maps settings on Data sources.

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/database/migrations/20260911000001_attendance_oos_accuracy.go` | Column `location_accuracy_percent` |
| `backend/bootstrap/migrations.go` | Register migration |
| `backend/app/models/pms.go` | Field + json tags on `AttendanceClock` |
| `backend/app/services/attendance_service.go` | Request-aware clock + accuracy scoring |
| `backend/app/http/controllers/mobile_controller.go` | Bind `out_of_station_request_id` |
| `backend/database/seeders/system_config_seeder.go` | Default settings keys |
| `backend/app/services/settings_service.go` | Expose/read/update OOS attendance settings |
| `frontend/src/api/services/admin.ts` | Types for new settings |
| `frontend/src/modules/settings/SettingsPage.tsx` | Settings UI block |
| `frontend/src/api/services/mobile.ts` | Clock payload + clock list types |
| `frontend/src/components/molecules/OosAttendanceMap.tsx` | Map: destination, geofence, clocks |
| `frontend/src/modules/attendance/AttendancePage.tsx` | Modes, select, map, history |

---

### Task 1: Settings keys + Data sources UI

**Files:**
- Modify: `backend/database/seeders/system_config_seeder.go`
- Modify: `backend/app/services/settings_service.go`
- Modify: `frontend/src/api/services/admin.ts`
- Modify: `frontend/src/modules/settings/SettingsPage.tsx`

**Interfaces:**
- Produces settings keys:
  - `oos.attendance.min_accuracy_percent` (default `70`, public)
  - `oos.attendance.default_geofence_radius_meters` (default `500`, public)
- Admin payload nest under `data_sources.oos_attendance`

- [ ] **Step 1: Seed defaults**

In `system_config_seeder.go` add:

```go
"oos.attendance.min_accuracy_percent":            {group: "data_sources", value: 70, public: true},
"oos.attendance.default_geofence_radius_meters": {group: "data_sources", value: 500, public: true},
```

- [ ] **Step 2: Expose in `dataSourcesConfig()` and `Update` path**

```go
"oos_attendance": map[string]any{
  "min_accuracy_percent":            s.GetInt("oos.attendance.min_accuracy_percent", 70),
  "default_geofence_radius_meters": s.GetInt("oos.attendance.default_geofence_radius_meters", 500),
},
```

Wire `Update("data_sources", …)` to persist these two keys (follow existing `google_maps` save pattern in the same service).

Also add under `PublicSettings()` so attendance UI can read threshold without admin permission:

```go
"oos_attendance": map[string]any{
  "min_accuracy_percent": s.GetInt("oos.attendance.min_accuracy_percent", 70),
  "default_geofence_radius_meters": s.GetInt("oos.attendance.default_geofence_radius_meters", 500),
},
```

- [ ] **Step 3: Settings UI**

On Data sources tab, after Google Maps section, add **Out-of-station attendance**:

- Number input: Minimum accuracy to pass (%) — default 70
- Number input: Default geofence radius (meters) — show helper `≈ X.XX miles` (`meters / 1609.34`)
- Save via existing `saveDataSources` mutation including `oos_attendance` object

- [ ] **Step 4: Verify**

Open `/settings?tab=data-sources`, set threshold to 75, save, reload — value persists.

---

### Task 2: Backend clock scoring + optional request ID

**Files:**
- Create: `backend/database/migrations/20260911000001_attendance_oos_accuracy.go`
- Modify: `backend/bootstrap/migrations.go`
- Modify: `backend/app/models/pms.go`
- Modify: `backend/app/services/attendance_service.go`
- Modify: `backend/app/http/controllers/mobile_controller.go`
- Modify: `backend/app/services/out_of_station_service.go` (add `GetApprovedForStaffOnDate` / `GetOwnedApproved` if missing)

**Interfaces:**
- `ClockInput` gains `OutOfStationRequestID *uint`
- When nil → station path only (`at_duty_station`)
- When set → validate owned + approved + date covers today; compute accuracy

- [ ] **Step 1: Migration + model**

```go
// Up: Schema Table attendance_clocks add Float("location_accuracy_percent").Nullable()
```

```go
LocationAccuracyPercent *float64 `json:"location_accuracy_percent,omitempty" gorm:"column:location_accuracy_percent"`
// Also add snake_case json tags on AttendanceClock fields used by UI (id, clock_type, verification_status, etc.)
```

Register in `bootstrap/migrations.go`.

- [ ] **Step 2: Unit-testable scoring helper**

In `attendance_service.go`:

```go
func LocationAccuracyPercent(distanceM, radiusM float64) float64 {
  if radiusM <= 0 {
    return 0
  }
  pct := (1 - distanceM/radiusM) * 100
  if pct < 0 {
    return 0
  }
  if pct > 100 {
    return 100
  }
  return pct
}
```

Add `backend/app/services/attendance_accuracy_test.go`:

```go
func TestLocationAccuracyPercent(t *testing.T) {
  if LocationAccuracyPercent(0, 500) != 100 { t.Fatal() }
  if LocationAccuracyPercent(250, 500) != 50 { t.Fatal() }
  if LocationAccuracyPercent(600, 500) != 0 { t.Fatal() }
}
```

Run: `go test ./app/services -run TestLocationAccuracyPercent -v` → PASS

- [ ] **Step 3: Rewrite Clock attachment logic**

```go
type ClockInput struct {
  // existing fields...
  OutOfStationRequestID *uint
}

// In Clock():
settings := NewSettingsService()
minPct := float64(settings.GetInt("oos.attendance.min_accuracy_percent", 70))
defaultRadius := settings.GetInt("oos.attendance.default_geofence_radius_meters", 500)

if input.OutOfStationRequestID != nil && *input.OutOfStationRequestID > 0 {
  oosReq, err := s.oos.GetApprovedOwnedForDate(input.StaffID, *input.OutOfStationRequestID, now)
  // error if not found / not approved / not covering date
  distance := haversineMeters(...)
  radius := float64(oosReq.GeofenceRadiusMeters)
  if radius <= 0 { radius = float64(defaultRadius) }
  pct := LocationAccuracyPercent(distance, radius)
  clock.OutOfStationRequestID = &oosReq.ID
  clock.DistanceFromDestinationMeters = &distance
  clock.LocationAccuracyPercent = &pct
  if pct >= minPct {
    clock.VerificationStatus = "verified_oos"
  } else {
    clock.VerificationStatus = "outside_geofence" // flagged below threshold
  }
} else {
  clock.VerificationStatus = "at_duty_station"
}
```

Remove call to `ActiveApprovedForDate` for silent attach.

- [ ] **Step 4: Controller bind**

```go
type clockBody struct {
  ClockType             string  `json:"clock_type"`
  Latitude              float64 `json:"latitude"`
  Longitude             float64 `json:"longitude"`
  AccuracyMeters        float64 `json:"accuracy_meters"`
  LocationLabel         string  `json:"location_label"`
  OutOfStationRequestID *uint   `json:"out_of_station_request_id"`
}
```

Pass ID into `ClockInput`.

- [ ] **Step 5: Verify**

`go test ./app/services -run TestLocationAccuracyPercent -v`  
`go build -o /dev/null .`

---

### Task 3: Frontend API types + Attendance page modes

**Files:**
- Modify: `frontend/src/api/services/mobile.ts`
- Modify: `frontend/src/modules/attendance/AttendancePage.tsx`

**Interfaces:**
- `attendanceService.clock({ clock_type, latitude, longitude, accuracy_meters?, out_of_station_request_id? })`
- Load OOS via existing `outOfStationService` / mobile OOS list; filter `status==='approved'` and date covers today

- [ ] **Step 1: Fix mobile attendance client**

```ts
clock: async (payload: {
  clock_type: 'in' | 'out'
  latitude: number
  longitude: number
  accuracy_meters?: number
  location_label?: string
  out_of_station_request_id?: number
}) => { ... }

export type AttendanceClockRow = {
  id: number
  clock_type: string
  clocked_at: string
  latitude: number
  longitude: number
  verification_status: string
  out_of_station_request_id?: number | null
  distance_from_destination_meters?: number | null
  location_accuracy_percent?: number | null
  // normalize PascalCase if needed via field()
}
```

Normalize list response like other mobile APIs if keys are PascalCase.

- [ ] **Step 2: Attendance UI state**

```ts
type Mode = 'station' | 'oos'
const [mode, setMode] = useState<Mode>('station')
const [selectedOosId, setSelectedOosId] = useState<number | null>(null)
```

- Mode segmented control: **At duty station** | **Out of station**
- When `oos`: `SearchableSelect` / `Select` of approved active requests (label: destination + date range)
- Clock disabled if `oos && !selectedOosId`
- Capture GPS includes `accuracy` from `pos.coords.accuracy`
- Mutate with `clock_type` and optional `out_of_station_request_id`

- [ ] **Step 3: History columns**

Show: Action, Time, Mode/Status (`at_duty_station` / `verified_oos` / `outside_geofence`), Accuracy % (if present), Flag badge when status is `outside_geofence` or accuracy &lt; threshold.

- [ ] **Step 4: Manual check**

Station clock works without OOS. OOS without select blocked. OOS with select sends ID.

---

### Task 4: Map component + accuracy preview

**Files:**
- Create: `frontend/src/components/molecules/OosAttendanceMap.tsx`
- Modify: `frontend/src/modules/attendance/AttendancePage.tsx`

**Interfaces:**
- Props: `destination: { lat, lng, name }`, `radiusMeters`, `clocks: { lat, lng, clock_type, accuracy_percent? }[]`, `current?: { lat, lng }`

- [ ] **Step 1: Implement map**

Use `useGoogleMapsApi()`; if no API key, show fallback text + link to Google Maps search.

Render Map with:
- Destination marker
- Circle radius = request geofence (or settings default)
- Clock markers (in/out colors)
- Optional current GPS marker before clock

Show live accuracy % when `current` + destination known (same formula client-side for preview before submit).

- [ ] **Step 2: Embed on Attendance**

When mode is `oos` and a request is selected, show map below the clock controls. Filter history clocks for that request ID onto the map.

- [ ] **Step 3: Verify**

Select OOS request → map loads destination circle. Capture GPS → preview % updates. Clock far away → flagged &lt; 70%.

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Station default / OOS select | Task 3 |
| No silent auto-attach | Task 2 |
| Accuracy % + 70% flag | Task 2 + 3 |
| Map preview | Task 4 |
| Data sources settings | Task 1 |
| `clock_type` fix | Task 3 |
| History verification | Task 3 |

## Placeholder / consistency review

- Formula and status names match the spec.
- Settings keys are consistent across seeder, service, and UI.
- Commits optional per user rule.

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-11-attendance-oos-map-accuracy.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh agent per task  
2. **Inline Execution** — implement in this session  

Which approach?

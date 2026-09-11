# Duty-Station Pin + Station Clock Accuracy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let employees and HR set a personal duty-station pin on Profile (facility fallback), verify station clocks against that pin with the same accuracy formula as OOS, and flag below a configurable **90%** default.

**Architecture:** Store optional pin on `staff_hr_profiles`. Resolve effective pin as personal → facility → none. Extend `AttendanceService.Clock` station branch to score GPS vs effective pin. Profile + Attendance UIs show map; settings under Data sources separate from OOS (70%).

**Tech Stack:** Goravel/Go, React, TanStack Query, existing Google Maps helpers (`PlaceAutocompleteField`, `OosAttendanceMap`), `system_configs`.

**Spec:** `docs/superpowers/specs/2026-09-11-duty-station-attendance-accuracy-design.md`

## Global Constraints

- Effective pin: personal override → active facility lat/lng → none.
- Missing pin after resolve → allow clock as `unverified_no_station_geo` (no accuracy %).
- Station pass mark default **90%** via `attendance.duty_station.min_accuracy_percent`.
- OOS path and `oos.attendance.*` (default 70%) unchanged.
- Same formula: `max(0, (1 - distance/radius) * 100)`.
- Do not commit unless the user explicitly asks.
- Preserve existing Google Maps and OOS attendance settings UI.

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/database/migrations/20260911000002_duty_station_pin.go` | HR profile duty-station columns |
| `backend/bootstrap/migrations.go` | Register migration |
| `backend/app/models/pms.go` | Fields on `StaffHrProfile` |
| `backend/database/seeders/system_config_seeder.go` | Duty-station settings defaults |
| `backend/app/services/settings_service.go` | Expose/update/public settings |
| `backend/app/services/duty_station_service.go` | Resolve effective pin |
| `backend/app/services/duty_station_service_test.go` | Unit tests for resolution helpers |
| `backend/app/services/attendance_service.go` | Station branch scoring |
| `backend/app/services/auth_service.go` | Update personal pin on profile |
| `backend/app/http/controllers/auth_controller.go` | Bind duty-station fields |
| `backend/app/services/ihris_sync_batch.go` | Enrich `StaffProfileDetail` |
| `backend/app/services/staff_admin` HR update path | HR can set pin |
| `frontend/src/api/services/auth.ts` | Types + payload |
| `frontend/src/api/services/admin.ts` | Settings + HR profile types |
| `frontend/src/modules/settings/SettingsPage.tsx` | Duty-station attendance section |
| `frontend/src/modules/profile/ProfilePage.tsx` | Duty station map + picker |
| `frontend/src/modules/attendance/AttendancePage.tsx` | Station map + statuses |

---

### Task 1: Migration, model, settings keys

**Files:**
- Create: `backend/database/migrations/20260911000002_duty_station_pin.go`
- Modify: `backend/bootstrap/migrations.go`
- Modify: `backend/app/models/pms.go` (`StaffHrProfile`)
- Modify: `backend/database/seeders/system_config_seeder.go`
- Modify: `backend/app/services/settings_service.go`
- Modify: `frontend/src/api/services/admin.ts`
- Modify: `frontend/src/modules/settings/SettingsPage.tsx`

**Interfaces:**
- Produces settings keys:
  - `attendance.duty_station.min_accuracy_percent` (default `90`, public)
  - `attendance.duty_station.default_geofence_radius_meters` (default `500`, public)
- Admin nest: `data_sources.attendance.duty_station`
- Public: `settings.duty_station_attendance`

- [ ] **Step 1: Migration**

```go
// Signature: 20260911000002_duty_station_pin
// Up: if staff_hr_profiles exists, add nullable:
//   duty_station_latitude (Float), duty_station_longitude (Float),
//   duty_station_label (String), duty_station_radius_meters (Integer)
// Guard with HasColumn like 20260911000001.
```

Register `&migrations.M20260911000002DutyStationPin{}` in `bootstrap/migrations.go`.

- [ ] **Step 2: Model fields**

On `StaffHrProfile` in `pms.go`:

```go
DutyStationLatitude      *float64 `json:"duty_station_latitude,omitempty" gorm:"column:duty_station_latitude"`
DutyStationLongitude     *float64 `json:"duty_station_longitude,omitempty" gorm:"column:duty_station_longitude"`
DutyStationLabel         *string  `json:"duty_station_label,omitempty" gorm:"column:duty_station_label"`
DutyStationRadiusMeters  *int     `json:"duty_station_radius_meters,omitempty" gorm:"column:duty_station_radius_meters"`
```

- [ ] **Step 3: Seed + settings service**

In seeder:

```go
"attendance.duty_station.min_accuracy_percent":            {group: "data_sources", value: 90, public: true},
"attendance.duty_station.default_geofence_radius_meters": {group: "data_sources", value: 500, public: true},
```

In `dataSourcesConfig()`:

```go
"attendance": map[string]any{
  "duty_station": map[string]any{
    "min_accuracy_percent":            s.GetInt("attendance.duty_station.min_accuracy_percent", 90),
    "default_geofence_radius_meters": s.GetInt("attendance.duty_station.default_geofence_radius_meters", 500),
  },
},
```

In `PublicSettings()`:

```go
"duty_station_attendance": map[string]any{
  "min_accuracy_percent":            s.GetInt("attendance.duty_station.min_accuracy_percent", 90),
  "default_geofence_radius_meters": s.GetInt("attendance.duty_station.default_geofence_radius_meters", 500),
},
```

In `UpdateGroup`, mark public when `strings.HasPrefix(key, "attendance.duty_station.")`.

- [ ] **Step 4: Settings UI**

Mirror OOS block: form state `dutyStationAttendanceForm`, load from `data_sources.attendance.duty_station`, save as:

```ts
attendance: { duty_station: dutyStationAttendanceForm }
```

Invalidate `['public-config', 'duty-station-attendance']` on save.

- [ ] **Step 5: Verify**

`go build -o /dev/null .` from `backend/`.  
Manual: Settings → Data sources shows Duty-station attendance (after redeploy/seed).

---

### Task 2: Resolve effective pin + station clock scoring

**Files:**
- Create: `backend/app/services/duty_station_service.go`
- Create: `backend/app/services/duty_station_resolve_test.go`
- Modify: `backend/app/services/attendance_service.go`

**Interfaces:**
- Produces:

```go
type EffectiveDutyStation struct {
  Latitude     float64 `json:"latitude"`
  Longitude    float64 `json:"longitude"`
  Label        string  `json:"label"`
  RadiusMeters int     `json:"radius_meters"`
  Source       string  `json:"source"` // personal | facility | none
}

func ResolveEffectiveDutyStation(staffID uint) EffectiveDutyStation
func HasCoords(lat, lng float64) bool // both non-zero
```

- Consumes: `LocationAccuracyPercent`, settings keys from Task 1.

- [ ] **Step 1: Failing unit test for pure helpers**

```go
func TestHasCoords(t *testing.T) {
  if HasCoords(0, 0) { t.Fatal() }
  if !HasCoords(0.3, 32.5) { t.Fatal() }
}

func TestPickEffectiveSource(t *testing.T) {
  // personal wins over facility when HasCoords(personal)
  // facility when personal nil
  // none when both missing
}
```

Prefer testing `PickEffectiveDutyStation(personalLat, personalLng, personalLabel, personalRadius, facilityLat, facilityLng, facilityName, defaultRadius)` as a pure function used by `ResolveEffectiveDutyStation`.

- [ ] **Step 2: Run test — expect FAIL**

Run: `go test ./app/services -run 'TestHasCoords|TestPickEffective' -v`  
Expected: FAIL (undefined).

- [ ] **Step 3: Implement resolver**

```go
func PickEffectiveDutyStation(...) EffectiveDutyStation {
  defaultRadius := ... // passed in, default 500
  if personalLat != nil && personalLng != nil && HasCoords(*personalLat, *personalLng) {
    r := defaultRadius
    if personalRadius != nil && *personalRadius > 0 { r = *personalRadius }
    return EffectiveDutyStation{Latitude: *personalLat, Longitude: *personalLng, Label: label, RadiusMeters: r, Source: "personal"}
  }
  if HasCoords(facilityLat, facilityLng) {
    return EffectiveDutyStation{..., Source: "facility", RadiusMeters: defaultRadius}
  }
  return EffectiveDutyStation{Source: "none", RadiusMeters: defaultRadius}
}

func (s *DutyStationService) ResolveEffectiveDutyStation(staffID uint) EffectiveDutyStation {
  // load StaffHrProfile by staff_id; load active StaffContract → Facility
  // call PickEffectiveDutyStation with settings default radius
}
```

- [ ] **Step 4: Station branch in `Clock`**

Replace bare `at_duty_station` assignment:

```go
} else {
  eff := NewDutyStationService().ResolveEffectiveDutyStation(input.StaffID)
  minPct := float64(settings.GetInt("attendance.duty_station.min_accuracy_percent", 90))
  if eff.Source == "none" || !HasCoords(eff.Latitude, eff.Longitude) {
    clock.VerificationStatus = "unverified_no_station_geo"
  } else {
    distance := haversineMeters(input.Latitude, input.Longitude, eff.Latitude, eff.Longitude)
    radius := float64(eff.RadiusMeters)
    if radius <= 0 { radius = float64(settings.GetInt("attendance.duty_station.default_geofence_radius_meters", 500)) }
    pct := LocationAccuracyPercent(distance, radius)
    clock.DistanceFromDestinationMeters = &distance
    clock.LocationAccuracyPercent = &pct
    if pct >= minPct {
      clock.VerificationStatus = "at_duty_station"
    } else {
      clock.VerificationStatus = "outside_geofence"
    }
  }
}
```

Leave OOS branch untouched.

- [ ] **Step 5: Verify**

```bash
go test ./app/services -run 'TestHasCoords|TestPickEffective|TestLocationAccuracyPercent' -v
go build -o /dev/null .
```

Expected: PASS + build OK.

---

### Task 3: Profile API — expose + employee/HR update

**Files:**
- Modify: `backend/app/services/ihris_sync_batch.go` (`StaffProfileDetail`, `GetStaffProfile`)
- Modify: `backend/app/services/auth_service.go`
- Modify: `backend/app/http/controllers/auth_controller.go`
- Modify: `backend/app/services/ihris_sync_batch.go` or staff admin service (`StaffHrProfileInput`, `UpdateHrProfile`)
- Modify: `backend/app/http/controllers/staff_admin_controller.go`
- Modify: `frontend/src/api/services/auth.ts`
- Modify: `frontend/src/api/services/admin.ts` (HR profile patch payload if typed)

**Interfaces:**
- `StaffProfileDetail` gains facility coords + personal fields + `EffectiveDutyStation EffectiveDutyStation \`json:"effective_duty_station"\``
- `PUT /auth/profile` body:

```go
DutyStationLatitude     *float64 `json:"duty_station_latitude"`
DutyStationLongitude    *float64 `json:"duty_station_longitude"`
DutyStationLabel        *string  `json:"duty_station_label"`
DutyStationRadiusMeters *int     `json:"duty_station_radius_meters"`
ClearDutyStation        bool     `json:"clear_duty_station"`
```

- [ ] **Step 1: Enrich `GetStaffProfile`**

When loading facility, set `FacilityID`, `FacilityLatitude`, `FacilityLongitude`.  
Load `StaffHrProfile` personal fields.  
Set `EffectiveDutyStation = NewDutyStationService().ResolveEffectiveDutyStation(staffID)`.

- [ ] **Step 2: Auth update path**

`AuthService.UpdateProfile` (or dedicated method): if user has `StaffID`, upsert `StaffHrProfile`:

- If `ClearDutyStation` → set lat/lng/label/radius pointers to nil.
- Else if lat+lng provided and `HasCoords` → save personal pin.
- Still allow photo/signature-only updates; if only duty-station fields sent, do not require photo.

Controller: treat “nothing to update” as false when duty-station fields or clear flag present.

- [ ] **Step 3: HR patch path**

Extend `updateHrProfileBody` + `StaffHrProfileInput` with same duty-station fields + `ClearDutyStation`. Persist in `UpdateHrProfile`.

- [ ] **Step 4: Frontend auth types**

```ts
export type EffectiveDutyStation = {
  latitude: number
  longitude: number
  label: string
  radius_meters: number
  source: 'personal' | 'facility' | 'none' | string
}

// on StaffProfileDetail:
facility_id?: number
facility_latitude?: number | null
facility_longitude?: number | null
duty_station_latitude?: number | null
duty_station_longitude?: number | null
duty_station_label?: string | null
duty_station_radius_meters?: number | null
effective_duty_station?: EffectiveDutyStation

export interface UpdateProfilePayload {
  profile_photo?: string
  signature_image?: string
  duty_station_latitude?: number
  duty_station_longitude?: number
  duty_station_label?: string
  duty_station_radius_meters?: number
  clear_duty_station?: boolean
}
```

- [ ] **Step 5: Verify**

`go build -o /dev/null .`  
After redeploy: `GET /auth/me` includes `effective_duty_station`.

---

### Task 4: Profile UI + Attendance station map/history

**Files:**
- Modify: `frontend/src/modules/profile/ProfilePage.tsx`
- Modify: `frontend/src/modules/attendance/AttendancePage.tsx`
- Reuse: `frontend/src/components/molecules/PlaceAutocompleteField.tsx`
- Reuse: `frontend/src/components/molecules/OosAttendanceMap.tsx` (or rename later; props already generic)

**Interfaces:**
- Consumes: `staff.effective_duty_station`, `authService.updateProfile`, public `duty_station_attendance` from `/config`.

- [ ] **Step 1: Profile Duty station section**

Under Employment & Placement:

- Show facility name + source badge (`Personal` / `Facility` / `Not set`).
- If effective source ≠ `none`, render `OosAttendanceMap` with destination = effective pin and `radiusMeters`.
- `PlaceAutocompleteField` → on select call `updateProfile` with lat/lng/label.
- Button **Clear personal pin** when personal override exists (`duty_station_latitude` set) → `{ clear_duty_station: true }`.
- Refresh `me` / auth store after save.

- [ ] **Step 2: Attendance station mode**

- Load `duty_station_attendance` from `/config` (min 90).
- When mode === `station` and effective pin available (from `useAuthStore` staff or `/auth/me`): show map + live preview % using station threshold.
- Notice when source `none`.
- History labels:
  - `at_duty_station` → At duty station
  - `unverified_no_station_geo` → Unverified (no station pin)
  - `outside_geofence` → Flagged (low accuracy)
- Flag badge when `outside_geofence` or (station clock with accuracy &lt; station min).

- [ ] **Step 3: Manual check**

1. Profile: set personal pin near facility → source Personal; clear → Facility or Not set.  
2. Attendance station clock near pin → `at_duty_station` ≥ 90%.  
3. Clock far away → `outside_geofence` + Flagged.  
4. OOS mode still uses 70% settings unchanged.

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| HR profile columns + facility fallback | Task 1–2 |
| Settings 90% / radius | Task 1 |
| Resolve + station scoring + unverified | Task 2 |
| `/auth/me` + employee/HR update | Task 3 |
| Profile UI map/picker | Task 4 |
| Attendance station map/history | Task 4 |
| OOS unchanged | Task 2 (explicit non-touch) |

## Placeholder / consistency review

- Settings keys match spec: `attendance.duty_station.*`.
- Public key name locked: `duty_station_attendance`.
- Status tokens: `at_duty_station`, `outside_geofence`, `unverified_no_station_geo`.
- Clear flag: `clear_duty_station`.

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-11-duty-station-attendance-accuracy.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh agent per task, review between tasks  
2. **Inline Execution** — implement in this session with checkpoints  

Which approach?

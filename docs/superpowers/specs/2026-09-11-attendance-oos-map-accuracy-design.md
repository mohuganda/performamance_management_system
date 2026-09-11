# Attendance OOS Request Selection + Map Accuracy Design

**Date:** 2026-09-11  
**Status:** Approved for implementation (Approach A)  
**Live surface:** `/attendance` (e.g. http://45.10.154.35:8081/attendance)  
**Settings:** `/settings?tab=data-sources`

## Problem

Employees clock in/out on Attendance without choosing an out-of-station (OOS) request. The backend silently attaches the first approved OOS for today. There is no map comparing clock locations to the requested destination, and no configurable accuracy threshold for flagging weak location matches.

## Goals

1. Default clock mode: **At duty station** (no OOS request).
2. Optional **Out of station** mode: employee must select an **approved** OOS request covering today before clocking.
3. Map preview: destination + geofence + associated clock points for the selected request.
4. Show **location accuracy %** relative to the selected destination; flag below configurable threshold (default **70%**).
5. Admin settings on Data sources for threshold (and default geofence radius, with miles helper text); percentage is the default score.
6. Fix clock payload (`clock_type`) and history verification display.

## Non-goals

- Duty-station facility geofencing (station clocks stay `at_duty_station` without facility GPS check in this iteration).
- Changing OOS approval workflow or request form beyond using existing destination/radius.
- Separate OOS attendance page (Approach B rejected).

## Design

### 1. Attendance clock modes

| Mode | UI | API | Verification |
|------|----|-----|----------------|
| At duty station (default) | No request picker | `clock_type` + GPS; **no** `out_of_station_request_id` | `at_duty_station` |
| Out of station | Required select of approved OOS covering today | `clock_type` + GPS + `out_of_station_request_id` | Score vs destination; see §2 |

- List approved OOS for current staff where `start_date ≤ today ≤ end_date`.
- Do **not** auto-attach an OOS when station mode is used.
- When OOS mode is used without a selected request ID → reject with clear error.

### 2. Accuracy % and flagging

```
distance_m = haversine(clock, destination)
radius_m   = request.GeofenceRadiusMeters (fallback: admin default)
accuracy_% = max(0, (1 - distance_m / radius_m) * 100)
```

- At destination → 100%; at fence edge → 0%; outside fence → 0%.
- If `accuracy_% < min_accuracy_percent` (default 70) → **flagged** (e.g. keep/extend `outside_geofence` or `below_accuracy_threshold`).
- If `accuracy_% ≥ threshold` and inside fence → `verified_oos`.
- UI shows percentage prominently; secondary line can show distance in meters/miles.

Persist on `AttendanceClock` (existing distance field + `verification_status`; add `location_accuracy_percent` if easy, else compute on read).

### 3. Map preview

When an OOS request is selected on Attendance (and optionally when viewing history filtered to that request):

- Destination marker
- Geofence circle (radius meters)
- Clock-in / clock-out markers for clocks linked to that request
- Use existing Google Maps API key from settings (`useGoogleMapsApi`)

Station-only clocks: no OOS map required (optional “your location” only is fine but not required).

### 4. Admin settings (Data sources)

New settings group **Out-of-station attendance** on Data sources tab:

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `oos.attendance.min_accuracy_percent` | number | 70 | Flag clocks below this % |
| `oos.attendance.default_geofence_radius_meters` | number | 500 | Default radius for new requests / fallback; UI shows miles equivalent |

Display: percentage is default scoring mode; show miles conversion helper for radius (`meters / 1609.34`).

### 5. API changes

- `POST /mobile/attendance/clock`: accept `out_of_station_request_id` (optional); require it when client indicates OOS mode **or** when ID present validate ownership + approved + date range; **stop** silent auto-pick when ID omitted (station path).
- Frontend sends `clock_type: 'in'|'out'` (fix current `action` mismatch).
- `GET /mobile/attendance/clocks`: include OOS id, distance, accuracy %, verification_status, destination summary if linked.
- `GET` approved OOS for clocking: reuse `/mobile/out-of-station/requests` filtered client-side or add thin `?status=approved&active_on=today` if needed.

### 6. Frontend files (expected)

| Path | Change |
|------|--------|
| `frontend/src/modules/attendance/AttendancePage.tsx` | Modes, request select, map, accuracy UI |
| `frontend/src/api/services/mobile.ts` | Payload + types |
| New small map component under `frontend/src/components/...` | Destination + geofence + clocks |
| `frontend/src/modules/settings/SettingsPage.tsx` | OOS attendance settings block |
| Backend `attendance_service.go`, `mobile_controller.go`, settings seeder | Scoring + settings keys |

## Testing

1. Station mode: clock without request → `at_duty_station`; no OOS id.
2. OOS mode without selection → blocked in UI / API error.
3. OOS mode with approved request near destination → high % , `verified_oos`, map shows pin inside circle.
4. Clock far from destination → low %, flagged below 70% (or configured threshold).
5. Change threshold in Data sources; new clocks use new value.
6. History shows verification and accuracy correctly.
7. Multiple overlapping approved trips: employee chooses which request.

## Success criteria

- Employees explicitly choose station vs OOS trip.
- Map makes destination vs clock location obvious.
- Accuracy % and &lt;70% (configurable) flagging are visible and enforced.
- Settings live under Data sources next to Maps.

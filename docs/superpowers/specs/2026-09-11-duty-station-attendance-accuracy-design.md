# Duty-Station Pin + Station Clock Accuracy Design

**Date:** 2026-09-11  
**Status:** Approved for implementation (Approach A)  
**Live surfaces:** `/profile`, `/attendance` (e.g. http://45.10.154.35:8081/profile)  
**Settings:** `/settings?tab=data-sources`  
**Related:** `docs/superpowers/specs/2026-09-11-attendance-oos-map-accuracy-design.md` (OOS path unchanged)

## Problem

Station clocks are recorded as `at_duty_station` with no GPS check against the employee’s workplace. Profile shows facility name only—no map or editable pin. Facility lat/lng often exists (sometimes district-level) but is unused for attendance. Duty-station verification should use the same accuracy formula as OOS, with a stricter default threshold (**90%**).

## Goals

1. Show duty station on **Profile** with facility context + effective pin (map).
2. **Personal override** on HR profile; **facility lat/lng** as fallback; employee and HR can set/clear the override.
3. Verify **At duty station** clocks against the effective pin; flag below **90%** (configurable).
4. If no usable pin after facility resolve → **allow** clock with `unverified_no_station_geo` (no accuracy %).
5. Separate settings from OOS (OOS remains default **70%**).

## Non-goals

- Changing how iHRIS assigns facility/contract placement.
- Requiring every facility to have precise GPS before anyone can clock.
- Merging OOS and duty-station thresholds into one setting.
- Building a full facility GIS admin tool (facility lat/lng may still be edited via existing lists admin).

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Pin model | Facility default + personal override (**Approach A**) |
| Who edits override | Employee on Profile **and** HR via staff HR profile |
| Missing geo | Allow clock; try facility; else `unverified_no_station_geo` |
| Station pass mark | Default **90%** (separate settings keys) |
| OOS path | Unchanged (existing `oos.attendance.*`, default 70%) |

## Design

### 1. Effective duty-station pin

Resolution order for attendance and Profile “effective” display:

1. Personal override on `staff_hr_profiles` if latitude **and** longitude are set (non-zero).
2. Else active contract → `facilities.latitude` / `facilities.longitude` if set (non-zero).
3. Else **none**.

Source label for UI: `personal` | `facility` | `none`.

### 2. Data model

Add nullable columns on `staff_hr_profiles`:

| Column | Type | Notes |
|--------|------|--------|
| `duty_station_latitude` | float, nullable | Personal override |
| `duty_station_longitude` | float, nullable | Personal override |
| `duty_station_label` | string, nullable | Place name / address text |
| `duty_station_radius_meters` | int, nullable | Optional; if unset use admin default |

Facility table unchanged (existing lat/lng).

### 3. Profile API + UI (`/profile`)

**Expose on `StaffProfileDetail` / `/auth/me` staff payload:**

- Existing `facility_name` plus `facility_id` (0/omit when no active facility)
- `facility_latitude`, `facility_longitude` (from active facility; may be null)
- `duty_station_latitude`, `duty_station_longitude`, `duty_station_label`, `duty_station_radius_meters` (personal)
- `effective_duty_station`: `{ latitude, longitude, label, radius_meters, source }` where `source` is `personal` | `facility` | `none`

**Employee update:** extend `PUT /auth/profile` to accept optional duty-station fields (in addition to photo/signature):

- Set: lat, lng, optional label, optional radius  
- Clear override: `clear_duty_station: true` → remove personal pin; facility fallback resumes  


**HR update:** extend `PATCH /api/v1/admin/staff/{id}/hr-profile` with the same fields so HR can set/correct.

**Profile UI:** “Duty station” section under Employment & Placement:

- Facility name (read-only)
- Effective source badge
- Map of effective pin + geofence circle (reuse attendance map patterns)
- Place picker to set personal pin; **Clear personal pin** when override exists
- Helper: “Clocks at duty station are scored against this pin (default pass mark 90%).”

### 4. Station clock verification

In `AttendanceService.Clock` when **no** `out_of_station_request_id`:

```
pin, source = ResolveEffectiveDutyStation(staffID)
radius_m = personal radius if set else attendance.duty_station.default_geofence_radius_meters (500)
min_pct  = attendance.duty_station.min_accuracy_percent (90)

if pin missing:
  verification_status = unverified_no_station_geo
  (no distance / accuracy %)
else:
  distance_m = haversine(clock, pin)
  accuracy_% = max(0, (1 - distance_m / radius_m) * 100)
  persist distance + accuracy_%
  if accuracy_% >= min_pct → at_duty_station
  else → outside_geofence  (flagged; same status token as OOS fail for UI reuse)
```

OOS branch unchanged: still requires selected approved request; uses `oos.attendance.min_accuracy_percent` (70).

### 5. Settings (Data sources)

| Key | Default | Public |
|-----|---------|--------|
| `attendance.duty_station.min_accuracy_percent` | `90` | yes |
| `attendance.duty_station.default_geofence_radius_meters` | `500` | yes |

Expose under admin `data_sources.attendance.duty_station` and under `PublicSettings` as `duty_station_attendance` (same shape: `min_accuracy_percent`, `default_geofence_radius_meters`) so Attendance/Profile can read without admin permission.

UI block: **Duty-station attendance** next to Out-of-station attendance (threshold % + radius with miles helper).

### 6. Attendance UI

- Station mode: show map vs **effective** pin when available; live accuracy preview before submit (same formula).
- If source is `none`, show notice: “No duty-station location yet—clock will be recorded as unverified until facility or personal pin is set.”
- History: status labels for `at_duty_station`, `outside_geofence`, `unverified_no_station_geo`; Flagged when `outside_geofence` or accuracy &lt; station threshold.

### 7. Permissions

- Employee: linked staff required to set own pin (same as profile photo).
- HR: existing staff HR-profile manage permission for admin PATCH.
- No new RBAC codes required unless profile update is split later.

## Spec coverage checklist

| Requirement | Section |
|-------------|---------|
| Profile shows duty station | §3 |
| Facility default + personal override | §1–2 |
| Employee + HR edit | §3 |
| Allow when unresolved; try facility | §1, §4 |
| 90% station default; OOS 70% separate | §4–5 |
| Same accuracy formula + flagging | §4 |
| Map on profile + attendance station mode | §3, §6 |

## Out of scope follow-ups

- Admin bulk “set facility GPS from map” campaign.
- Separate `below_accuracy_threshold` status distinct from `outside_geofence`.
- Mobile-native app UX beyond current web Attendance page.

# HRM Attend attendance clock export

PMS can **push** OOS attendance clocks to HRM Attend and expose a **pull** API for HRM.

## Push (PMS → HRM)

- **URL:** `{hrm_attend.api_url}/api/outoftstation_clockin`  
  (CodeIgniter REST method `outoftstation_clockin_post`, same pattern as `POST /api/clock_user`)
- **Auth:** `Authorization: Bearer {JWT}` — same JWT as other Attend APIs (`validateRequest`)
  - PMS obtains JWT via Attend `POST /api/login` using Settings username/password, or uses optional stored `jwt_token`
- **Source field:** always `performance_system`
- **Do not** call or modify HRM’s existing `clock_user` / `clock_user_post` (that route stays without JWT)

### Example payload (compatible with `clock_user`)

```json
{
  "ihris_pid": "person|123",
  "facility_id": "facility|456",
  "clock_status": "IN",
  "clock_time": "2026-09-11T10:15:00+03:00",
  "latitude": 0.34,
  "longitude": 32.58,
  "entry_id": "pms-entry-uuid",
  "location_label": "optional OOS place",
  "source": "performance_system"
}
```

Attend also accepts PMS aliases `employee_number` and `clock_type`. If `facility_id` is omitted, Attend looks it up from `ihrisdata`.

Only clocks with `out_of_station_request_id` set are exported. Successful exports are recorded in `hrm_attend_export_log` and are not pushed again.

### Admin triggers

- Settings → Data sources → **Push OOS clocks now**
- Schedule: daily `03:30` (`hrm-attend:export-push`) when `export_push_enabled` is true
- Artisan: `./moh-pms-api artisan hrm-attend:export-push`

## Pull (HRM → PMS)

```
GET /api/v1/integrations/hrm-attend/attendance-clocks?from=&to=&since_id=&limit=200&mark_exported=false
```

Auth (one of):

- `Authorization: Bearer {export_pull_token}`
- `X-Hrm-Attend-Token: {export_pull_token}`

Set the token in Settings → Data sources. If `mark_exported=true`, PMS writes success rows to `hrm_attend_export_log` so push will skip those clocks.

## Background inbound summary sync

- `POST /api/v1/hrm-attend/sync/start` (also `POST /hrm-attend/sync`)
- `POST /api/v1/hrm-attend/sync/resume` / `cancel`
- `GET /api/v1/hrm-attend/sync/status`
- Schedule: `15 0 1 * *` (1st of month 00:15, previous month)

## iHRIS background sync

- `POST /api/v1/ihris/sync/start|resume|cancel`
- `GET /api/v1/ihris/sync/status`
- Schedule: daily `03:00`

Host cron (required for schedules):

```bash
* * * * * docker exec moh-pms-api ./moh-pms-api artisan schedule:run
```

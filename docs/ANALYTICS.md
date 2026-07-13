# Apache Doris analytics

Apache Doris is the optional **OLAP** (analytics) store for MoH PMS. MySQL remains the **system of record** for all writes. Dashboard and attendance analytics prefer Doris when it is connected, and **automatically fall back to MySQL** if Doris is disabled or unreachable.

## Default behaviour

| Setting | Default |
|---------|---------|
| `ANALYTICS_DB_ENABLED` | **`true`** (enabled by default) |
| `ANALYTICS_DB_HOST` | `127.0.0.1` locally; `host.docker.internal` in Docker API containers |
| `ANALYTICS_DB_PORT` | `9030` (MySQL protocol) |
| `ANALYTICS_DB_DATABASE` | `moh_pms_analytics` |

To turn analytics off entirely:

```bash
ANALYTICS_DB_ENABLED=false
```

## Start Doris

```bash
docker compose -f docker-compose.analytics.yml up -d
```

| Endpoint | URL |
|----------|-----|
| FE MySQL protocol | `localhost:9030` |
| FE HTTP | `localhost:8030` |
| BE HTTP | `localhost:8040` |

First boot can take several minutes while FE/BE register. Then open **Settings → Data sources → Apache Doris analytics** and click **Sync OLTP data to Doris**.

## Production (`./setup.sh`)

`setup.sh` writes analytics variables into `deploy/.env` with Doris **enabled by default**. The API container reaches the FE on the host via `host.docker.internal`.

1. Deploy the app as usual (`./setup.sh …`)
2. Start Doris: `docker compose -f docker-compose.analytics.yml up -d`
3. In the UI (user with `settings.data_sources.manage`), sync OLTP → Doris

## Local Docker API

Root `docker-compose.yml` sets:

```yaml
ANALYTICS_DB_ENABLED: "true"
ANALYTICS_DB_HOST: host.docker.internal
```

and `extra_hosts: host.docker.internal:host-gateway` so Linux Docker can reach the published FE port.

## What uses Doris

- HR / director dashboard attendance trends
- National and district out-of-station rates
- Related OLAP-style aggregates in `DorisAnalyticsService`

Writes (leave requests, clock events, PPA, etc.) never go to Doris directly — they stay in MySQL until an admin sync replicates them.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Status: Enabled but unreachable | Start `docker-compose.analytics.yml`; confirm port 9030 is open |
| Sync button disabled / failing | Wait for FE healthy; check `docker logs moh-pms-doris-fe` |
| Dashboards look unchanged | Expected until first successful sync; MySQL fallback is active |
| API in Docker cannot open Doris | Use `ANALYTICS_DB_HOST=host.docker.internal` (already the compose default) |

Observability Stack

This stack adds metrics, traces, and dashboards for local development.

Components
- OpenTelemetry Collector: receives OTLP traces from the API/worker and forwards them.
- Prometheus: scrapes `http://host.docker.internal:3000/metrics` (API) by default.
- Grafana: visualizes Prometheus metrics; import dashboards listed below.

Usage
- Enable tracing in the app by setting `OTEL_ENABLED=1` and optional `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`.
- Start API and Worker locally using existing npm scripts.
- In a separate terminal, run Docker Compose in this folder.

Provisioning
- Grafana auto-loads the Prometheus datasource, the NOFX dashboard, and two alert rules via provisioning mounts.
- No manual setup needed: use the Dev Settings page → Start Observability, then open Grafana.

Dashboards
- Import Grafana dashboards (recommended IDs):
  - 1860 (Node Exporter Full) – use for inspiration
  - 11074 (Node.js Application) – app-level metrics
  - Create a custom dashboard with panels for:
    - `rate(steps_total{status="succeeded"}[5m])` vs `status="failed"`
    - `histogram_quantile(0.95, sum(rate(http_request_duration_ms_bucket[5m])) by (le, route))`
    - Queue depth by state: `queue_depth`
    - DB timings: `histogram_quantile(0.95, sum(rate(db_query_duration_ms_bucket[5m])) by (le))`

Provided Dashboard + Alerts
- Import the prebuilt dashboard JSON:
  - Grafana → Dashboards → Import → Upload file
  - File: `docs/observability/dashboards/nofx-observability.json`
  - Select your Prometheus datasource when prompted.
- Includes two classic alerts (panel-based):
  - Error rate > 5% for 5 minutes
  - Queue depth > 50 on `step.ready` for 10 minutes
  - Note: If unified alerting is enforced, recreate these under Alerting → Alert rules using the same queries.

Notes
- On Linux, replace `host.docker.internal` with `host.docker.internal:host-gateway` or add `extra_hosts`.
- The collector pipeline sends traces to logs by default; adjust to OTLP/Jaeger as needed.

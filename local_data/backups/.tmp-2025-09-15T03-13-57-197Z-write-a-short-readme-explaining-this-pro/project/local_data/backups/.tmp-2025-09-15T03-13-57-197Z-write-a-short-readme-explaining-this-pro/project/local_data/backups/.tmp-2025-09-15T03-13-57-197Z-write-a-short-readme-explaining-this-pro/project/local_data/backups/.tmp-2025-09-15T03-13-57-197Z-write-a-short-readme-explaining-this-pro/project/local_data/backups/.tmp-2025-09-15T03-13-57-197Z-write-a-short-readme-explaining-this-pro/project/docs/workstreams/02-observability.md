Workstream 02 — Observability

Objective
Traceable, debuggable system with standardized logs, traces, and metrics.

Steps
1) Logging
   - Add request ID middleware; include runId/stepId correlation.
   - Standard fields: `status`, `latencyMs`, `retryCount`, `provider`.
2) Tracing
   - Integrate OpenTelemetry SDK; instrument Express, pg, Redis, HTTP.
   - Export OTLP to local collector (docker-compose target) or console for dev.
3) Metrics
   - Prometheus client: queue depth, step durations (histograms), successes/failures, retries, DLQ size, DB timings.
   - Add `/metrics` endpoint.
4) Dashboards
   - Provision Grafana dashboards; document docker-compose stack.

Validation
- Manual: visualize a run trace spanning API → queue → worker → provider.
- Alerts: configure thresholds for queue age and error rate.


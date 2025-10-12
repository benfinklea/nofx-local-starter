# Run Trace Logging

The control plane now supports an opt-in trace log that records every
significant action in the run lifecycle. When enabled, the worker and API write
detailed events (run creation, step creation, enqueue decisions, execution
results, etc.) to both stdout and an append-only log file under
`local_data/logs/`.

## Enable the trace logger

Set the following environment variables before starting the API/worker:

```bash
# Enable the verbose trace events
export RUN_TRACE_LOG=true

# Persist logs to disk (optional, defaults shown)
export LOG_FILE_ENABLED=true
export LOG_FILE_DIR=local_data/logs
export LOG_FILE_PATH=local_data/logs/nofx-trace.log
```

On Vercel, add these variables in the project settings (or scope them to a
single environment) and redeploy. Locally, you can add them to `.env` or export
them before running `npm run dev`.

## What gets logged

When `RUN_TRACE_LOG=true`, the following events are captured with contextual
metadata:

- Run creation requests/responses (API + server handlers)
- Step creation, persistence, enqueue/skip decisions, inline execution
- Queue backpressure calculations and enqueue payloads
- Worker execution lifecycle (begin, handler completion, remaining-step
  evaluation, success, failure, timeout)
- Run list queries (count, project filters)

All trace lines include `trace: true` and a short event name (e.g.
`step.execute.success`). Each entry is written as structured JSON so it can be
ingested into log processors or filtered with tools like `jq`.

## Rotating or clearing logs

The log file path is fully configurable via `LOG_FILE_PATH`. You can point it to
any writable location (e.g. `/tmp/nofx-run-trace.log` or an absolute path). The
destination is opened in append mode; truncate or rotate the file as needed
using standard tooling (`logrotate`, `cp /dev/null`, etc.).

## Disabling tracing

- To stop writing trace entries but keep standard logs, unset
  `RUN_TRACE_LOG` (or set it to `false`).
- To stop writing to disk while keeping stdout logs, set
  `LOG_FILE_ENABLED=false`.

Trace logging is completely opt-in and does not impact production performance
unless it is explicitly enabled.

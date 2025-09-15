Step 65

- Control plane: Deploy or update control services; confirm API, scheduler and controllers are healthy and in sync.
- Verification: Run automated and smoke checks; validate logs, metrics and expected API responses.
- Workers: Drain/update worker nodes, uncordon and confirm pods reschedule and pass readiness/liveness checks.
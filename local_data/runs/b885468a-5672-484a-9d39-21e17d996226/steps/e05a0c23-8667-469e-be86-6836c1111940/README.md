Step 91

- Control plane: finalize deployment/upgrade of control-plane components (API servers, controllers, etcd); apply manifests and ensure services are running and healthy.
- Verification: run health checks and smoke tests (kubectl get/status, logs, metrics) to confirm readiness and absence of critical errors.
- Workers: cordon/drain, update and restart worker nodes as needed, then uncordon and verify workloads reschedule and nodes report Ready.
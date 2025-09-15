Step 98

- Control plane — apply updated control-plane manifests/config, restart control services, and ensure control components (API, controller, etcd) reach Ready.
- Verification — run health checks (API liveness, component status), inspect logs for errors, and confirm all control-plane pods report Ready.
- Workers — drain targeted nodes, update/restart kubelet/agent as needed, uncordon and verify workloads rescheduled and running.
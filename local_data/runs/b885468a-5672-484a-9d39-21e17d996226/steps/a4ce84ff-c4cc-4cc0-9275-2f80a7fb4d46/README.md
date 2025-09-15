Step 64

- Control plane — Apply control-plane changes (API server, controller-manager, scheduler); verify etcd health and ensure backups/cert rotation.
- Verification — Run smoke tests and health checks (API liveness, component status), review logs and metrics for errors.
- Workers — Drain and update/replace worker nodes, confirm kubelet/CNI compatibility, uncordon and validate pod rescheduling.
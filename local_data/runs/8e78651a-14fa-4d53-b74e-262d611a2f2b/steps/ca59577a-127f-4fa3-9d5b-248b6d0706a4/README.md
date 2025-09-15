Step 39

- Control plane: Bring up or update control-plane components (etcd, API server, controller-manager, scheduler); apply configs/secrets and confirm component health.
- Verification: Run health checks and smoke tests (API responsiveness, etcd quorum, node Ready status, critical pods running); inspect logs for errors.
- Workers: Join or update worker nodes (drain/uncordon as needed), ensure kubelet configuration is applied, and confirm workloads are scheduled and healthy.
Step 66

- Control plane: Deploy or update control-plane components (API server, controller-manager, scheduler); apply config and RBAC; ensure etcd is healthy and backed up.
- Verification: Confirm API responsiveness, validate component health endpoints, check logs, run smoke tests (e.g., create/read pod), and verify cluster state.
- Workers: Join or update worker nodes, ensure kubelet/container runtime running, verify node Ready status, and confirm workloads schedule and network connectivity.
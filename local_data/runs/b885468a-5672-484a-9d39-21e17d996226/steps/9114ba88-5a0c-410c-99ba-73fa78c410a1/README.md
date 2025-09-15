Step 35

- Control plane: Ensure API server, controller-manager and scheduler are running and healthy; check control-plane logs and health endpoints.
- Verification: Run quick health checks and smoke tests (e.g., kubectl get nodes/pods, curl /healthz); confirm etcd quorum and component readiness.
- Workers: Join or validate worker nodes; verify kubelet/kube-proxy are active, pods can be scheduled, and networking is functional.
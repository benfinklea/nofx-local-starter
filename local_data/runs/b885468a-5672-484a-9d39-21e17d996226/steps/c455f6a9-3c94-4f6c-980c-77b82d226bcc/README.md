Step 58

- Control plane: Confirm API server, controller-manager, scheduler and etcd are healthy; apply config changes and restart control-plane pods if required.
- Verification: Run quick checks (kubectl get nodes, pods -A; inspect logs and health endpoints) to ensure cluster readiness.
- Workers: Ensure kubelet, kube-proxy and CNI are running on worker nodes; join, drain or restart nodes as needed and verify pods schedule and operate normally.
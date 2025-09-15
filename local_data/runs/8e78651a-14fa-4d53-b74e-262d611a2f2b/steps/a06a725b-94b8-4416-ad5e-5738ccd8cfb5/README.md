Step 88

- Control plane: Bring up/validate API server, controller-manager, scheduler and etcd; ensure certificates and manifests are applied and healthy.
- Verification: Run sanity checks (kubectl get nodes/pods, etcd health, API responses), smoke tests, and confirm RBAC/networking.
- Workers: Join/validate worker nodes (kubelet, kube-proxy), ensure correct labels/taints and that workloads schedule and run.
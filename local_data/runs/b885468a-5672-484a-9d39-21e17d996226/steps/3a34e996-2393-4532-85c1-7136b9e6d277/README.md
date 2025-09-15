Step 17

- Control plane: deploy/verify API server(s), controller manager, scheduler and etcd with proper TLS, HA and backups.
- Verification: run sanity checks (API responsiveness, etcd health, controller/component status) and confirm all control-plane components report healthy.
- Workers: join worker nodes, ensure kubelet/kube-proxy and CNI are running, and that nodes show Ready (adjust taints/labels if needed).
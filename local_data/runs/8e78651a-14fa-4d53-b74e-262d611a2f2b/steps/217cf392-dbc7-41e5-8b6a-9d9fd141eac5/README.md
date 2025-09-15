Step 94

- Control plane — start and verify API server, controller-manager, scheduler and etcd; ensure TLS certs are valid and health endpoints are green.
- Verification — run health checks (API /healthz, etcdctl cluster-health), inspect logs, and deploy a smoke pod to confirm basic functionality.
- Workers — join worker nodes (token/CSR), start kubelet/kube-proxy, label as needed and confirm kubectl get nodes shows Ready.
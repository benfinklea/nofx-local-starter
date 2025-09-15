Step 6

- Control plane — deploy or upgrade API server, controller-manager and scheduler; ensure etcd quorum and secure API access.
- Verification — run health checks (API responsiveness, etcd, component statuses), confirm DNS and basic pod scheduling.
- Workers — join/register worker nodes, start kubelet/kube-proxy, verify nodes Ready and workloads schedule correctly.
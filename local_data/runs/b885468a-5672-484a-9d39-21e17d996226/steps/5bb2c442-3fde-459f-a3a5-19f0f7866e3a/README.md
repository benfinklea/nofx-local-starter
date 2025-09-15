Step 78
- Control plane — Apply control-plane changes (API server/controller/scheduler), check etcd quorum and health.
- Verification — Run smoke checks and e2e sanity tests, review logs and metrics, confirm core services (DNS, kube-system) are healthy.
- Workers — Drain/upgrade nodes as needed, restart/validate kubelet and kube-proxy, uncordon and confirm workloads resume.
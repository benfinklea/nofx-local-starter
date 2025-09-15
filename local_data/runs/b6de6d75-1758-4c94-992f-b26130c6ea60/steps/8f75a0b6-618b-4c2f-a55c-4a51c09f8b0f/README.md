Step 2

- Control plane — Initialize and configure master components (API server, etcd, controller-manager, scheduler); enable TLS and HA.
- Verification — Validate cluster health: API responsiveness, etcd quorum, control-plane pods Ready, and component logs/health endpoints.
- Workers — Join worker nodes (install runtime, kubelet, kube-proxy), run join workflow, verify nodes are Ready and schedule pods.
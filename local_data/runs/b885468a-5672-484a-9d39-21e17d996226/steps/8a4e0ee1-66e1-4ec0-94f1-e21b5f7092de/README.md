Step 60

- Control plane — ensure API server, etcd, controller-manager and scheduler are running and reachable.
- Verification — run health checks (kubectl get nodes/pods, API/etcd endpoints), validate manifests and TLS/RBAC.
- Workers — join/verify worker nodes (kubelet/kube-proxy running), confirm nodes are Ready and can schedule pods.
Test 1

- Control plane — Ensure API server, controller-manager and scheduler are running, reachable, and etcd quorum is healthy.
- Verification — Run smoke checks (health endpoints, basic API CRUD, metrics); test passes when all checks succeed.
- Workers — Provision worker nodes with kubelet/kube-proxy, confirm Node Ready and that pods can be scheduled and networked.
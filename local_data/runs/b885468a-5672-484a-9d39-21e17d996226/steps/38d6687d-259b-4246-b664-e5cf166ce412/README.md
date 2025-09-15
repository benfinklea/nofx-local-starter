Step 12

- Control plane: start/deploy API server, controller-manager and scheduler; ensure etcd is healthy and stable.
- Verification: run health checks (API /healthz, etcd leader), and confirm with kubectl (get nodes, get pods).
- Workers: join worker nodes to the cluster, verify nodes reach Ready, and deploy a test pod to confirm scheduling.
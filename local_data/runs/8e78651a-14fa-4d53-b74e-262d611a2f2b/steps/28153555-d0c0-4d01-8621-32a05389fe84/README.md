## Step 26

- Control plane — Ensure API servers, controller managers and etcd are running and reachable; confirm control-plane components report healthy.
- Verification — Run quick health checks and smoke tests (component status, core pods, logs) and fix any failures.
- Workers — Join/verify worker nodes (kubelet/kube-proxy active, nodes in Ready state) and schedule a test workload.
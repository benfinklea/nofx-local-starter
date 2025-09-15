Step 0

- Control plane — Bootstrap management components (API server, controller, scheduler, datastore); ensure HA, secure credentials, and networking to nodes.
- Verification — Run health checks and smoke tests (API responsiveness, etcd health, control loops, DNS, basic pod scheduling).
- Workers — Provision and join worker nodes; validate kubelet, CNI, node readiness, and ability to run test workloads.
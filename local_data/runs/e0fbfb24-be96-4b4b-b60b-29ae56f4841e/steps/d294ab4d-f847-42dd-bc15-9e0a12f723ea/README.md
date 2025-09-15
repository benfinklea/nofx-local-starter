Step 4

- Control plane — deploy/configure API server, controller-manager, scheduler; ensure etcd HA and certificates.
- Verification — run health checks and smoke tests; confirm control-plane components and core services are Ready.
- Workers — join worker nodes, verify kubelet connectivity and labels, and run a sample pod to confirm scheduling.
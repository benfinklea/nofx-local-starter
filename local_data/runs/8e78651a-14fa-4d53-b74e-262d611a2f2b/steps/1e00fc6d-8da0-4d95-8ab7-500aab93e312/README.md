Step 23

- Control plane — Deploy/start control-plane components (API server, controller-manager, scheduler, etcd) and ensure configs are applied.
- Verification — Run quick health checks (API responsiveness, component statuses, logs) to confirm control plane is healthy.
- Workers — Join worker nodes with the join command/token and verify they appear Ready and can run pods.
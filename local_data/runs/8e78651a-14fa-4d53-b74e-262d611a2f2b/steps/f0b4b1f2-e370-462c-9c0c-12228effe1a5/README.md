Step 97

- Control plane: Apply changes to master nodes one-at-a-time; ensure etcd quorum and API server health.
- Verification: Run quick health checks (nodes, control-plane pods, critical services) and smoke tests.
- Workers: Drain workers in batches, apply updates, uncordon and confirm workloads return to normal.
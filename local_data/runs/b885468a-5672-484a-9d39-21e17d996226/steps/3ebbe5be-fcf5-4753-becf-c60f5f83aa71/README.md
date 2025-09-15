Step 68
- Control plane: Apply configuration/patches, ensure API server/scheduler/controller-manager are running, verify etcd health and backups.
- Verification: Run health checks and smoke tests, inspect logs/metrics, confirm endpoints, and validate successful rollouts.
- Workers: Ensure nodes are Ready, kubelet/container runtime health, drain/uncordon as needed, and verify workloads are scheduling and healthy.
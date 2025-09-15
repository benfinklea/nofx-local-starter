Step 61

- Control plane: deploy or update API server, controller-manager and scheduler; confirm etcd quorum and component health.
- Verification: run health checks and basic tests (kubectl get nodes/pods, check no CrashLoopBackOff), confirm services/endpoints are reachable.
- Workers: drain/cordon and upgrade/configure nodes, rejoin them to the cluster, verify workloads reschedule and node labels/taints are correct.
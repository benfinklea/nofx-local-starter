Step 71

- Control plane: apply/upgrade control-plane manifests (API server, controller-manager, scheduler, etcd); ensure etcd quorum and backups.
- Verification: run smoke checks (kubectl get nodes/pods, api responsiveness), confirm component statuses and logs, validate cluster health.
- Workers: drain and upgrade or provision worker nodes, verify kubelet/CNI are running, then uncordon and recheck workloads.
Step 72

- Control plane: Apply or update control-plane manifests (API server, controller-manager, scheduler, etcd); ensure backups exist, perform rolling restarts or scaling as required, confirm leader election and quorum.
- Verification: Run smoke checks (kubectl get nodes/pods, core component health endpoints), validate etcd and control-plane logs, confirm RBAC/policy rules and service connectivity.
- Workers: Cordon/drain nodes as needed, upgrade/replace kubelet and kube-proxy, restart CNI agents, uncordon and verify workloads reschedule and pass readiness/liveness probes.
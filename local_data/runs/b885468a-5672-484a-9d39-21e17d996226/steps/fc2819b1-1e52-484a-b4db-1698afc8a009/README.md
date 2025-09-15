Step 87

- Control plane — apply control-plane changes (API server, controller-manager, scheduler, etcd); ensure etcd quorum and backups before making modifications.
- Verification — confirm health and connectivity: check API responsiveness, component statuses, etcd health, and relevant logs; ensure no failing kube-system pods.
- Workers — roll worker updates: cordon & drain, apply kubelet/container runtime changes, restart and uncordon; verify nodes return to Ready and workloads recover.
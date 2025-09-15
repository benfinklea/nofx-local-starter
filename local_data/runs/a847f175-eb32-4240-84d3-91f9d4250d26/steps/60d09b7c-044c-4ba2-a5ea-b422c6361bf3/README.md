Step 1
- Control plane: Provision/deploy API server, controller-manager, scheduler and etcd; ensure control-plane services are running.
- Verification: Run health checks (API responsiveness, component statuses, etcd health) and confirm required certificates/configs.
- Workers: Provision and join worker nodes to the cluster; verify kubelet registration and Node Ready status.
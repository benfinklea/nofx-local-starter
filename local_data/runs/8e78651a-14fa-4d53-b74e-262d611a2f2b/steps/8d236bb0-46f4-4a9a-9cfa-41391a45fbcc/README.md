Step 22

- Control plane: Bootstrap/control-plane components (etcd, API server, controller-manager, scheduler), ensure certificates and kubeconfigs are applied and services are running.
- Verification: Run quick health checks (API reachable, etcd healthy, kubectl get nodes/components, inspect logs) and confirm master components report Ready.
- Workers: Join worker nodes with the join token/command, verify nodes show Ready, apply necessary labels/taints and confirm workloads can be scheduled.
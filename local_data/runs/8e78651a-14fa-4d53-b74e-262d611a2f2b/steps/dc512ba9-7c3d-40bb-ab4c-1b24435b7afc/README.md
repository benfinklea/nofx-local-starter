Step 41
- Control plane: Ensure API server, controller-manager, scheduler and etcd are healthy; apply control-plane manifests or restart components if degraded.
- Verification: Run smoke tests and health checks (kubectl get nodes/pods, API responsiveness, cluster DNS); confirm expected state.
- Workers: Drain/update/join worker nodes as required; verify kubelet/kube-proxy are running and workloads are rescheduled.
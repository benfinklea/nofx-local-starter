Step 76
- Control plane: Update/apply control-plane components (API server, controller-manager, scheduler), ensure pods become Ready and etcd is healthy.
- Verification: Run smoke checks (API /healthz, kubectl get nodes/pods, check component logs and versions) and confirm no errors.
- Workers: Drain and upgrade workers one-at-a-time, restart/verify kubelet and kube-proxy, then uncordon and confirm workloads return to Ready.
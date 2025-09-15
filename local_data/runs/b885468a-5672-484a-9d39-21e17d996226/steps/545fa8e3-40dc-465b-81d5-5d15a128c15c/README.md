Step 74

- Control plane: Apply/update control-plane manifests, confirm etcd and API server are running and healthy, and ensure leader election and certificates are valid.
- Verification: Run health checks and smoke tests (API responsiveness, controller-manager/scheduler status, critical pod logs), and validate cluster state with kubectl.
- Workers: Drain and update worker nodes one at a time, restart kubelet/kube-proxy if needed, uncordon after verification, and confirm workloads reschedule successfully.
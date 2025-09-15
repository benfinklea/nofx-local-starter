Step 86

- Control plane: Ensure API server, controller-manager and scheduler are deployed and healthy; apply/rollout any control-plane manifest changes and update kubeconfigs as needed.
- Verification: Confirm cluster health (e.g., control-plane pods running, kubectl get nodes/pods show Ready) and check logs/metrics for errors.
- Workers: Join or restart worker nodes, verify kubelet and kube-proxy are running, and ensure workloads schedule and run on workers.
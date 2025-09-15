Step 85

- Control plane: Deploy or update API server, controller-manager and scheduler; ensure etcd is healthy and manifests/configs are applied.
- Verification: Confirm cluster health (e.g., kubectl get nodes; kubectl get pods -n kube-system; check API responsiveness and etcd endpoints).
- Workers: Join or validate worker nodes (kubelet/kube-proxy running, CNI configured); label/taint nodes as needed and confirm workloads schedule.
Step 89

- Control plane: Ensure API server, controller-manager, and scheduler are running and reachable; apply any control-plane config/upgrade and confirm etcd health.
- Verification: Run quick health checks (kubectl get nodes/pods -A, kubectl get componentstatuses or cluster-info), test API responses, and scan logs for errors.
- Workers: Join or upgrade worker nodes, confirm kubelet/kube-proxy are running, pods schedule correctly, and nodes report Ready.
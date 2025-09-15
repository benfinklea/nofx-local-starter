Step 36

- Control plane: Deploy or update control-plane components (etcd, kube-apiserver, controller-manager, scheduler); verify HA and certificate validity.
- Verification: Run health checks (API liveness/readiness, etcdctl endpoint health, kubectl get nodes/pods -n kube-system), inspect logs and metrics for errors.
- Workers: Join and configure worker nodes (kubelet, CNI), confirm nodes are Ready and workloads schedule correctly; address taints/cordon if needed.
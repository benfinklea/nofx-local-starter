Step 43

- Control plane: Ensure control-plane services are running (etcd quorum, kube-apiserver, controller-manager, scheduler); apply any control-plane config/certs as needed.
- Verification: Run health checks (kubectl cluster-info; kubectl get nodes,pods -A; etcdctl/ API readiness); review logs for errors.
- Workers: Join or validate worker nodes (kubelet/kube-proxy active), uncordon/label/taint appropriately, deploy a test pod to confirm scheduling and networking.
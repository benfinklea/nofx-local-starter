Step 93

- Control plane — Ensure API server, controller-manager and scheduler are running and reachable; confirm etcd health and certificate validity; apply/update control-plane manifests as needed.
- Verification — Run quick health checks: kubectl get pods -n kube-system, kubectl get cs/componentstatuses, curl /healthz on API server, inspect logs for errors; confirm service endpoints and etcd leader.
- Workers — Join or validate worker nodes (kubeadm join or cloud autoscale), ensure kubelet and CNI are healthy, check pods are scheduling, and apply required node labels/taints.
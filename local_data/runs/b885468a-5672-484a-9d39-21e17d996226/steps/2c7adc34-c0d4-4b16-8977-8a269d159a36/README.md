Step 29

- Control plane: Deploy/verify API server, controller-manager, scheduler and etcd; apply control-plane manifests and ensure etcd backups/config are correct.
- Verification: Check health and responsiveness (kubectl get pods -n kube-system, kubectl get nodes, API /healthz, etcd leader), and confirm RBAC/networking basics.
- Workers: Join or validate worker nodes (kubelet/kube-proxy running), ensure nodes are Ready and can schedule a test workload.
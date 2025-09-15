Step 59

- Control plane — deploy or update control-plane components (etcd, API server, controller-manager, scheduler); ensure certificates, LB, and networking are configured and services are running.
- Verification — run quick health checks (API /healthz, kubectl get componentstatuses, etcdctl/member list), inspect logs and metrics, confirm no errors and that control plane is reachable.
- Workers — join or upgrade worker nodes, ensure kubelet/kube-proxy are healthy, verify nodes are Ready and pods schedule correctly (kubectl get nodes && kubectl get pods -A), cordon/uncordon as needed.
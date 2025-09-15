Step 42

- Control plane — Deploy/control-plane components (API server, controller-manager, scheduler, etcd); configure HA, certs, and secure API access.
- Verification — Run smoke/health checks (API /healthz, kubectl get nodes/pods/componentstatuses), review logs and metrics.
- Workers — Join workers, ensure kubelet/kube-proxy and CNI are running, verify node Ready state and Pod scheduling.
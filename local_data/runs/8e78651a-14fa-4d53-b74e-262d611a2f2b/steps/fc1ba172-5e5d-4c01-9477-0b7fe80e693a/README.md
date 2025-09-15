Step 80

- Control plane: Perform rolling updates of API server, controller-manager and scheduler; apply manifests, ensure etcd leader stability and component readiness before proceeding.
- Verification: Run smoke tests and health checks (etcd health, kube‑api responsiveness, controller statuses), review logs/metrics, and confirm no service disruptions.
- Workers: Cordon/drain nodes, update kubelet and kube‑proxy or rejoin nodes as needed, uncordon and verify nodes are Ready and pods are rescheduled.
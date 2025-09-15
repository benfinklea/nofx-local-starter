Step 70
- Control plane: Ensure API server, controller-manager, scheduler and etcd are up and healthy; apply/refresh manifests and certificates as needed.
- Verification: Run smoke checks (kubectl get nodes,pods; component healthz; check logs and endpoints); confirm etcd consistency and DNS resolution.
- Workers: Join or validate worker nodes, ensure kubelet/kube-proxy and CNI are running, then schedule a sample pod to confirm workload placement.
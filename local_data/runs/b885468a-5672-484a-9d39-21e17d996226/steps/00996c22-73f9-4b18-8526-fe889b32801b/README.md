Step 16

- Control plane: Start/configure control-plane components (API server, controller-manager, scheduler); apply control-plane manifests and confirm services are reachable.
- Verification: Run quick health checks (kubectl cluster-info, kubectl get pods -n kube-system, kubectl get nodes) and validate API responsiveness and component statuses.
- Workers: Join worker nodes (kubeadm join or equivalent), ensure kubelet/kube-proxy are running, and confirm nodes become Ready and workloads schedule.
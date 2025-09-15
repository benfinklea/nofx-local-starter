Step 44

- Control plane — ensure API server, controller-manager, scheduler and etcd are running; apply control-plane manifests or restart services as needed.
- Verification — run health checks (kubectl get nodes,pods -A; check component statuses, etcd quorum and API responsiveness).
- Workers — join or validate worker nodes (kubeadm join if required); ensure kubelet and container runtime are healthy and pods can schedule.
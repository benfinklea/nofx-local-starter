Step 18

- Control plane: confirm API server, controller-manager, scheduler and etcd are running and healthy (kubectl get pods -n kube-system; check pod statuses).
- Verification: validate cluster state (kubectl cluster-info; kubectl get nodes,pods -A) and inspect logs for errors.
- Workers: ensure kubelet and kube-proxy are active; join or reprovision nodes as needed (kubeadm join <token>), then apply labels/taints.
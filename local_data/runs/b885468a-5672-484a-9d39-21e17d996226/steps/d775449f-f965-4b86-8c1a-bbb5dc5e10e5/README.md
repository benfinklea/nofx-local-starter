Step 19

- Control plane: Start and verify control-plane components (kube-apiserver, controller-manager, scheduler, etcd); apply control-plane manifests and confirm services are running.
- Verification: Use kubectl (e.g., kubectl get nodes,pods -A; kubectl get cs) and component logs to confirm Ready/Healthy; deploy a small test pod.
- Workers: Join worker nodes (kubeadm join or cloud-init), ensure kubelet/CRI and kube-proxy are active; verify nodes are Ready and can run work.
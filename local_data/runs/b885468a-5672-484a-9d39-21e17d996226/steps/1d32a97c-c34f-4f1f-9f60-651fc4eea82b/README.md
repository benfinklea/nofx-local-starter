Step 20

- Control plane: Start/confirm control-plane services (etcd, kube-apiserver, controller-manager, scheduler) are running and certificates/configs are in place; ensure control-plane pods show Running.
- Verification: Confirm cluster health with kubectl cluster-info, kubectl get nodes, and kubectl get pods -n kube-system (and etcdctl endpoint health if applicable).
- Workers: Join worker nodes (e.g., kubeadm join <control-plane>:6443 --token <token> --discovery-token-ca-cert-hash <hash>), verify nodes become Ready, and check kubelet/kube-proxy on each worker.
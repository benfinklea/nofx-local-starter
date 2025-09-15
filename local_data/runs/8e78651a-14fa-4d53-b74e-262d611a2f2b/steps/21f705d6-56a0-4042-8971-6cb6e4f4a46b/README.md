Step 27

- Control plane: bring up/control-plane components (etcd, kube-apiserver, controller-manager, scheduler); apply any remaining manifests and ensure kubelet is running on control nodes.
- Verification: confirm cluster health (kubectl get nodes && kubectl get pods -A); check control-plane endpoints and etcd health (kubectl get pod -n kube-system; curl/port-check to API server).
- Workers: join worker nodes (kubeadm join or your provisioning method), verify they appear Ready (kubectl get nodes) and schedule pods; label/taint nodes as required.
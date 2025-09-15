Step 24

- Control plane: Provision and configure master components (etcd, kube-apiserver, controller-manager, scheduler); apply required manifests and RBAC.
- Verification: Run smoke checks (kubectl get nodes/pods, componentstatuses), confirm etcd and API health, and validate network and DNS.
- Workers: Join workers (kubeadm/token or cloud-init), verify nodes become Ready, apply labels/taints and confirm workloads schedule.
Step 14

- Control plane: Start/configure API server, controller manager, scheduler and etcd; secure control-plane endpoints with TLS and RBAC.
- Verification: Check cluster health (API responsiveness, kubectl get nodes/pods, component statuses), review control-plane and etcd logs, confirm etcd member list.
- Workers: Join worker nodes (kubelet, kube-proxy), install network plugin, ensure nodes reach Ready state and apply required labels/tolerations.
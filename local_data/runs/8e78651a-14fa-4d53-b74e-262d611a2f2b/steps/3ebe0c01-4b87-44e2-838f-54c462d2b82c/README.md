Step 38

- Control plane: Ensure API server, controller-manager and scheduler are running and reachable.
- Verification: Run quick checks (kubectl get pods -n kube-system, kubectl get nodes), inspect logs and endpoints.
- Workers: Join/confirm worker nodes, verify kubelet/kube-proxy health, apply required labels/taints.
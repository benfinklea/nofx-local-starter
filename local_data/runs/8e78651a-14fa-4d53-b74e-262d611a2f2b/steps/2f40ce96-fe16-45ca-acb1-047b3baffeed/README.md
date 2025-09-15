Step 84

- Control plane: Deploy and verify API server, controller-manager and scheduler; ensure etcd is healthy and certificates/configs are in place.
- Verification: Run quick checks (API responsiveness, kubectl get nodes/pods, component statuses, core DNS) and review relevant logs.
- Workers: Join nodes with the join token, confirm kubelet/kube-proxy and CNI are running and each node reaches Ready.
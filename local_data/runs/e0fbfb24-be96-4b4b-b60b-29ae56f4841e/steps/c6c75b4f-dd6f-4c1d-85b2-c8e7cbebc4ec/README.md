Step 5
- Control plane — deploy/configure API server, controller-manager and scheduler; ensure etcd connectivity, certificates and HA.
- Verification — run smoke checks: API responsiveness, control-plane health endpoints, etcd status, kube-system pods and logs.
- Workers — provision and join worker nodes, install kubelet/kube-proxy and CNI, verify nodes show Ready and pods are scheduled; apply labels/taints as needed.
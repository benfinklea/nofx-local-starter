Step 48

- Control plane — Deploy/upgrade control-plane components; ensure API server, controller-manager and scheduler are running and responsive.
- Verification — Perform health checks (API responses, etcd status), kubectl get nodes/pods, and run quick smoke tests.
- Workers — Join or update worker nodes; verify kubelet/kube-proxy, confirm nodes are Ready, and run a test workload.
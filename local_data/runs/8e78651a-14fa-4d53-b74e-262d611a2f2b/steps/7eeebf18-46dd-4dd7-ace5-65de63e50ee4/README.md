Step 47

- Control plane — Initialize or update control-plane components (API server, controller-manager, scheduler); ensure TLS, etcd connectivity and leader election are healthy.
- Verification — Run health checks and smoke tests (API responsiveness, etcd status, controller/scheduler logs); confirm all control-plane pods report Ready.
- Workers — Join or reconcile worker nodes (kubelet, CNI, kube-proxy); verify nodes Ready, pods scheduling, and expected labels/taints applied.
Step 21
- Control plane: Ensure all control-plane nodes are up, core components (etcd, kube-apiserver, controller-manager, scheduler) are running and healthy; apply configuration or upgrades as needed.
- Verification: Run health checks and smoke tests (API responsiveness, etcd quorum, controller loops); check logs and metrics, and confirm cluster objects (nodes, system pods) are in expected state.
- Workers: Join or validate worker nodes, ensure kubelet and CNI are functional, run a test workload on workers and verify network/storage access.
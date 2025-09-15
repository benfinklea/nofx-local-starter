Step 40

- Control plane: finalize rollout — ensure control-plane nodes/masters are healthy, API endpoints reachable, TLS certs valid and configs applied.
- Verification: run smoke checks — kubectl get nodes/pods, confirm etcd quorum and component health, and run basic readiness/e2e tests.
- Workers: join and validate workers — verify kubelet registration, correct taints/labels, scheduling capacity, and run a sample workload.
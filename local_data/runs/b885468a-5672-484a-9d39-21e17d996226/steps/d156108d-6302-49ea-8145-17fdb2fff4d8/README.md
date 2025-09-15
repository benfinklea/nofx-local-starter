Step 10

- Control plane: Deploy/upgrade control-plane components, ensure API server, controller-manager and scheduler are running and etcd is healthy.
- Verification: Run smoke tests and health checks (API discovery, node/pod statuses, core DNS), confirm no critical errors in logs.
- Workers: Join or update worker nodes, apply labels/taints as needed, schedule test workloads and verify they run and communicate correctly.
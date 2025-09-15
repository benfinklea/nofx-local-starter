Step 98

- Control plane: Ensure API server, controller-manager and scheduler are healthy and running desired config; apply changes safely and monitor leader election.
- Verification: Run health checks and smoke tests (component status, /healthz, critical pods), confirm desired state and metrics.
- Workers: Drain and update worker nodes as needed, restart kubelet/services, uncordon and verify pods reschedule and nodes report Ready.
Step 92

- Control plane: Apply config/patches and roll updates to API servers/etcd; confirm leader election and component health.
- Verification: Run smoke tests, check pod/node status, review logs and metrics for errors.
- Workers: Drain and upgrade worker nodes or deploy agents; ensure workloads resume and resource usage is normal.
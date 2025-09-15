Step 30

- Control plane: Deploy/update control-plane components (API server, controller, scheduler, etcd); ensure HA, certificates, and etcd backups are in place.
- Verification: Validate cluster health and API access (component status, endpoints, logs); run a quick smoke test (simple pod/service) to confirm functionality.
- Workers: Join/upgrade worker nodes, verify kubelet and CNI are running, ensure nodes reach Ready and workloads can be scheduled.
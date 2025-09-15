Step 83

- Control plane: Ensure API servers, controllers, and etcd are running and healthy; apply any pending manifests/config changes.
- Verification: Run health checks (kubectl get componentstatuses, node/pod status), confirm no errors in logs, and validate endpoints respond.
- Workers: Roll out updates or join/remove nodes as needed; verify kubelet and CRI are healthy and pods schedule successfully.
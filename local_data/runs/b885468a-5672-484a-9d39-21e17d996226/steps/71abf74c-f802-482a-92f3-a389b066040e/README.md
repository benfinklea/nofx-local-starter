Step 81

- Control plane — ensure API server, controller-manager, scheduler are healthy; apply configs/certs and perform rolling restarts as needed.
- Verification — run health checks and smoke tests, inspect logs, confirm endpoints and component statuses.
- Workers — verify kubelet/kube-proxy on each node, drain/update nodes if required, ensure all nodes report Ready and pods schedule.
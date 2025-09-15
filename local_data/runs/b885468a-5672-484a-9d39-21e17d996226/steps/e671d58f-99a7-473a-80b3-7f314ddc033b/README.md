Step 95

- Control plane: confirm etcd, kube-apiserver, controller-manager and scheduler are healthy and responding; verify leader election and backups.
- Verification: run quick health/smoke checks (API, DNS, CNI, RBAC), review logs/metrics and ensure no critical errors.
- Workers: ensure all worker nodes are Ready, kubelet/kube-proxy healthy, pods scheduling and services reachable; cordon/drain/rejoin as needed.
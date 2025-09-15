Step 90

- Control plane — Ensure API server, controller-manager and scheduler are healthy; verify etcd quorum/backups and apply any updated manifests/certs.
- Verification — Run smoke tests (API reachability, kubectl get nodes/pods), check health endpoints and relevant logs, confirm automated checks pass.
- Workers — Ensure kubelet/kube-proxy are Running and nodes show Ready; perform rolling restarts or join/remediate nodes and reconcile labels/taints as needed.
Step 51

- Control plane — ensure API server, controller-manager and scheduler are running; verify etcd healthy and manifests applied.
- Verification — perform health checks (eg. kubectl cluster-info, kubectl get pods -n kube-system, /healthz), inspect logs and endpoints.
- Workers — join/validate worker nodes, confirm kubelet/kube-proxy active and nodes show Ready; deploy a test pod to verify scheduling.
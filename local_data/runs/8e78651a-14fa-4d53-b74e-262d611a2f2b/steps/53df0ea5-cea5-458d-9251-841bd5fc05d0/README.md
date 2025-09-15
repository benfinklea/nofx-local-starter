Step 55

- Control plane: Ensure API server, controller-manager and scheduler are running and responsive; apply needed config or patches.
- Verification: Run health checks (API, etcd quorum, pod/node readiness), review logs and metrics, and perform a quick smoke test.
- Workers: Confirm worker nodes are Ready, kubelet/kube-proxy healthy; restart or drain/update any failing nodes.
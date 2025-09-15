Step 7
- Control plane: Initialize and configure API server, etcd, controller-manager and scheduler; apply control-plane manifests and ensure services are running and reachable.
- Verification: Run health checks (kubectl get componentstatuses/nodes/pods), test API access, inspect logs and certificates, and confirm control-plane endpoints respond.
- Workers: Install kubelet/kube-proxy and container runtime, join each worker to the cluster, verify node Ready status and run a simple test workload.
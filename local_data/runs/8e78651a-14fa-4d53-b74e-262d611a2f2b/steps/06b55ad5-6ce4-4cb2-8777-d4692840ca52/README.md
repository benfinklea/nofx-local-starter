Step 99

- Control plane — finalize rollout: ensure API servers, controllers and etcd are running and reconciled; apply final manifests and confirm kubeconfigs/certs are up to date.  
- Verification — smoke tests: kubectl get nodes,pods -A; check API /healthz, core DNS and controller health; scan logs for critical errors.  
- Workers — validate node health: confirm kubelet/kube-proxy are running, nodes are Ready, uncordon/join drained nodes as needed and verify workloads schedule and serve traffic.
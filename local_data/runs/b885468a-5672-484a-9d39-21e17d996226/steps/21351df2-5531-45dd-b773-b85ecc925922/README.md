Step 96
- Control plane: deploy/update API server, controller-manager, scheduler and etcd; confirm control-plane pods are Running and etcd is healthy.
- Verification: run health checks (kubectl get nodes/components, API responsiveness, check logs and certificates) and resolve any errors.
- Workers: join/validate worker nodes, ensure kubelet/kube-proxy are running, nodes are Ready and workloads can schedule.
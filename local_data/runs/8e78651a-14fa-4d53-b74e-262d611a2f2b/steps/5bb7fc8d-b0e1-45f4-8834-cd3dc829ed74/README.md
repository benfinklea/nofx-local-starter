Step 34

- Control plane: Ensure API server, controller-manager, scheduler and etcd are running and using the correct certificates/config; restart services or apply config changes as needed.
- Verification: Confirm cluster health (kubectl get nodes; kubectl get pods -A), check etcd/API health, and verify control-plane components report Ready.
- Workers: Join/verify worker nodes (kubelet, kube-proxy up), confirm CNI is configured and pods schedule correctly; remediate or replace any failed nodes.
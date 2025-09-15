Step 15

- Control plane — Deploy and configure control-plane components (API server, controller-manager, scheduler, etcd); ensure certificates, kubeconfig, and API high-availability are in place.
- Verification — Run quick health checks: kubectl get componentstatuses/nodes/pods, inspect control-plane logs, confirm etcd quorum and cluster DNS.
- Workers — Join worker nodes with the join token, verify node Ready state, apply necessary labels/taints, and confirm workloads can schedule and reach the network.
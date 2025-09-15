Step 63

- Control plane: Apply control-plane manifests/updates, ensure etcd quorum and API-server/controller-manager/scheduler are healthy and secured.
- Verification: Run smoke checks and health probes (API responsiveness, etcd status, controller logs) and confirm cluster objects reconcile.
- Workers: Drain and update worker nodes, restart kubelet/CNI as needed, rejoin nodes and validate pods/services recover.
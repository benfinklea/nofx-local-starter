Step 33

- Control plane — Deploy or update API server, controller-manager, scheduler and etcd; ensure HA, valid certs and stable etcd membership.
- Verification — Confirm API responsiveness and component health (kube-apiserver, controller-manager, scheduler, etcd); check logs, run smoke tests and validate versions.
- Workers — Join or upgrade worker nodes, verify kubelet/kube-proxy and CNI are running, ensure nodes are Ready and correctly tainted/labeled.
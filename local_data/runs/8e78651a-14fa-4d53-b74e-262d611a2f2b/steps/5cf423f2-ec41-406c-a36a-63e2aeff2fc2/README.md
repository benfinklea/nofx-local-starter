Step 28

- Control plane — Provision/start control-plane nodes; ensure etcd quorum and API server, controller-manager, scheduler are running and reachable.
- Verification — Run quick health checks (kubectl get nodes/pods, API /healthz, smoke deploy) and inspect logs for errors.
- Workers — Join/configure worker nodes; confirm kubelet/kube-proxy active, nodes show Ready and pods can be scheduled (networking/CNI validated).
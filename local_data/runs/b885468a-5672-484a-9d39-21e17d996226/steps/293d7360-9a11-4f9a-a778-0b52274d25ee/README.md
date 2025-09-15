Step 54

- Control plane — apply updates/changes to API servers, controllers, and etcd; ensure quorum and control-plane services are healthy.
- Verification — run quick health checks (API responsiveness, component status, node/pod readiness) and confirm no failing critical workloads.
- Workers — cordon/drain as needed, perform upgrades or config changes, then uncordon and verify kubelet/kube-proxy and pod rescheduling.
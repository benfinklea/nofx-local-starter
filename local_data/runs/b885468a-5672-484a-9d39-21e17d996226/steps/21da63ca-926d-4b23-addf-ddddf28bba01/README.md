Step 32

- Control plane: apply control-plane changes (API server, controller-manager, scheduler); ensure HA, certificates, and etcd health.
- Verification: run health and smoke checks — API responsiveness, control-plane pod readiness, etcd, RBAC, and key cluster objects.
- Workers: drain and update nodes as needed (kubelet/kube-proxy), validate NodeReady, pod scheduling, and service connectivity.
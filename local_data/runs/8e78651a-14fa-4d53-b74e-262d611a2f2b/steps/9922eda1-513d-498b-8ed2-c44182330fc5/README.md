Step 56

- Control plane — ensure API server, controller-manager, scheduler and etcd are running and healthy; confirm certificates and leader elections.
- Verification — run smoke checks (kubectl get nodes,pods; check component logs, etcd health) and automated tests if available.
- Workers — join/validate worker nodes, confirm kubelet and CNI are functional, and pods can be scheduled and reach network services.
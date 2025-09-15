Step 11

- Control plane: Install/configure API server, etcd, controller-manager and scheduler; apply TLS, backups and HA settings.
- Verification: Validate cluster health (kubectl get nodes/pods, API responsiveness, etcd quorum), run smoke tests and basic networking checks.
- Workers: Join workers to the control plane, install kubelet/kube-proxy and CNI, confirm node readiness and correct taints/labels.
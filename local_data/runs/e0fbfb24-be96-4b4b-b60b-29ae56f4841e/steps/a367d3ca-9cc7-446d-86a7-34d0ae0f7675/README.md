Step 3

- Control plane — Deploy and configure API server, controller manager, and scheduler; enable HA and RBAC.
- Verification — Run health checks (API responsiveness, component status, certs) and confirm cluster control endpoints.
- Workers — Join worker nodes (kubelet, kube-proxy, container runtime), verify Ready state and correct labels/taints.
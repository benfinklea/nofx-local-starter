Step 2

- Control plane: Initialize/configure core services (API, scheduler, controllers, LB); ensure HA and secure access.
- Verification: Run health checks and smoke tests; validate endpoints, certificates, and metrics.
- Workers: Join worker nodes, install runtime/CNI, apply labels/taints; confirm node readiness and pod scheduling.
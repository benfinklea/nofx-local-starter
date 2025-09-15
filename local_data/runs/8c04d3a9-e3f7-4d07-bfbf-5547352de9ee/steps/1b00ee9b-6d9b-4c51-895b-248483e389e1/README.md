NOFX

- Control plane — Central orchestration and policy engine: stores desired state, coordinates rollouts, enforces RBAC and safety gates.
- Verification — Automated pre- and post-deploy checks: linting, tests, formal/automated validation and drift detection to prevent unsafe changes.
- Workers — Distributed agents that execute tasks and run workloads: isolated, autoscalable, report status back to the control plane.
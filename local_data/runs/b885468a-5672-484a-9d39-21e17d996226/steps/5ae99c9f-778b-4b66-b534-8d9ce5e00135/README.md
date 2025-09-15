Step 49

- Control plane: ensure API server, controller-manager, scheduler and etcd are running, healthy, and reachable; apply any required config/rollouts.
- Verification: perform quick sanity checks (API responsiveness, health endpoints, kube-system pods, key logs, basic smoke tests).
- Workers: update/scale worker nodes as needed, verify kubelet/CNI health, and confirm pods schedule and run correctly.
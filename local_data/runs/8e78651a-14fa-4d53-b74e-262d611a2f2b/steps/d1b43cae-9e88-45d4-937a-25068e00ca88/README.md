Step 37

- Control plane: Deploy or upgrade control‑plane components (API server, controller‑manager, scheduler, etcd); ensure configs/certs applied and services are running.
- Verification: Quick health checks — API responsiveness (healthz), kube‑system pods, node status and logs; run a smoke test (small pod) to confirm scheduling.
- Workers: Join or update worker nodes (kubelet/kube‑proxy, CNI); confirm nodes become Ready, pods receive IPs, and workloads schedule correctly.
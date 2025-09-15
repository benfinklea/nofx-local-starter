Step 95

- Control plane: ensure API servers, controller managers and schedulers are running on designated hosts; apply any pending configs and confirm leader election/ha status.
- Verification: run health checks (API responsiveness, etcd quorum, controller and scheduler health), review logs for errors, and execute a quick smoke test against the cluster.
- Workers: confirm kubelet/kube-proxy are active and nodes are Ready, verify taints/labels are correct, and deploy a small test workload to validate scheduling and network.
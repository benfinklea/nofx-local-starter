Step 8

- Control plane: Deploy and configure API server, controller-manager and scheduler; confirm etcd is healthy and control-plane certificates/manifests are in place.
- Verification: Run quick checks (API health, component statuses, kube-system pods, etcd member list) and inspect logs to confirm control-plane readiness.
- Workers: Join worker nodes (kubeadm join or equivalent), ensure kubelet/kube-proxy are running, and verify nodes become Ready and pods are scheduled.
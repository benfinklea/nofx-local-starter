Step 62

- Control plane: ensure API server, etcd, controller-manager and scheduler are running (check static manifests or systemd); confirm certificates and control-plane networking are healthy.
- Verification: run quick checks — kubectl get nodes && kubectl get pods -A; curl -k https://<apiserver>:6443/healthz and etcdctl endpoint health; inspect relevant logs if any status is not Ready.
- Workers: verify kubelet, kube-proxy and CRI are active on each worker, nodes appear Ready, and join tokens/bootstrap config are valid; drain/uncordon or restart services as needed.
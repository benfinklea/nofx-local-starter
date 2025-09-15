Step 75

- Control plane: Bring up/control API server, controller-manager, scheduler and etcd; ensure TLS certs and manifests are in place and processes are running.
- Verification: Confirm control plane health (API responsiveness, etcd quorum), check kube-system pods and logs, and verify cluster resources respond as expected.
- Workers: Join or reconnect worker nodes (kubeadm join or equivalent), ensure kubelet and kube-proxy are running, and confirm worker nodes report Ready.
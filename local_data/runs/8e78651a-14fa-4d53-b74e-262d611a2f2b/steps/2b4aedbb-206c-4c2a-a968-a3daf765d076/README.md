Step 25

- Control plane — Deploy or update control-plane components (etcd, API server, controller-manager, scheduler). Ensure certificates are valid, manifests applied, and services are running and reachable.

- Verification — Run quick health checks: confirm API server responds, etcd quorum is healthy, and control-plane pods are Ready (e.g., kubectl get pods -n kube-system, kubectl get nodes). Deploy a small smoke test to validate scheduling and API behavior.

- Workers — Join or restart worker nodes (kubeadm join or cloud autoscaling). Ensure kubelet and CNI are functional, nodes report Ready, and workloads can be scheduled; cordon/drain and relabel as needed.
Step 31

- Control plane: Ensure control-plane components (kube-apiserver, controller-manager, scheduler) are running and healthy; check logs and endpoints.
- Verification: Run quick sanity checks (kubectl get nodes,pods -A; healthz/API check); confirm system pods, DNS, and API responsiveness.
- Workers: Confirm worker nodes are Ready, kubelet active, and pods scheduling; cordon/drain and remediate any failing nodes.
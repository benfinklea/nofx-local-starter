Step 45

- Control plane: Update/deploy control-plane components (API server, controller-manager, scheduler, etcd); confirm all control-plane pods are Running and Ready.
- Verification: Run health checks (kubectl get nodes/pods, componentstatuses, etcdctl health), exercise API with smoke tests and confirm expected responses.
- Workers: Drain workers one-by-one, apply updates/restarts, uncordon and verify Pods reschedule and workloads pass.
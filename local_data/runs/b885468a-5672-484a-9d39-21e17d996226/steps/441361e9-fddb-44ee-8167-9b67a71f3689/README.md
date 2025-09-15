Step 69

- Control plane — confirm API server, controller-manager, and scheduler are healthy; apply config changes and restart components if needed.
- Verification — run health checks and smoke tests; validate endpoints, metrics, and logs for errors.
- Workers — ensure nodes/kubelets are Ready and registered; drain/uncordon as required and verify pods redeploy correctly.
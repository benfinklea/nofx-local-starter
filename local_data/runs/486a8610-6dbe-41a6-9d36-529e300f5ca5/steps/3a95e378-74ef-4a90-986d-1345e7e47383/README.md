Try

- Control plane — start the control plane (apply the control-plane manifest or run the control-plane service) and confirm it's healthy (health endpoint / status).
- Verification — run the verification suite (verification binary or manifest) to validate configs, policies and API responses.
- Workers — launch worker instances, ensure they register with the control plane and process jobs; scale to test behavior.
Workstream 03 — Security & Policy

Objective
Constrain tool and data access; enforce human review on risk.

Steps
1) Tool policy
   - Step schema: `tools_allowed[]`, `env_allowed[]`, `secrets_scope`.
   - Worker reads policy and constructs a minimal environment.
2) Secrets
   - Integrate a secrets provider (env or file-based in dev); rotateable and scoped per run.
3) Manual gates
   - Default manual approval for `git_pr`, `deploy`, `db_write:dangerous`.
   - Approval UI already exists; extend with reasons and audit log.
4) Security gates
   - SAST, dep audit, secret scan; block on fail; artifacts captured.

Validation
- E2E: attempt disallowed tool; ensure denial and event record.


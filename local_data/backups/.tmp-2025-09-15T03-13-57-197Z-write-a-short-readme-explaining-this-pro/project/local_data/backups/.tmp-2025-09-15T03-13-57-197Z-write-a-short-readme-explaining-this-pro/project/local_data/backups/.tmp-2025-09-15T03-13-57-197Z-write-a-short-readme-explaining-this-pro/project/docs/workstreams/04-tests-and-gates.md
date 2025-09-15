Workstream 04 — Tests, Gates, and Coverage

Objective
Raise confidence to enterprise levels with strong automated gates.

Steps
1) Unit tests
   - 100% coverage on orchestration core and adapters; enforce changed-lines ≥ 0.90 gate.
2) Contract tests
   - Queue adapters (memory/redis/pg), store adapters (fs/db), provider adapters (mocked + canary).
3) Property tests
   - Randomized DAGs; verify determinism and resumption.
4) Fault injection
   - Simulate network errors, timeouts, restarts; assert retries/DLQ.
5) E2E
   - Playwright: Settings, New Run (standard), Approval flow, Artifact download.

How to run (dev)
- `npm run gates`
- `npm run test:unit`


# 📡 NOFX Control Plane · Phase 5 — Observability & Review Center

> Goal: make every run traceable, support resumable context, and add new gates like AI PR review.

---

## Track A — State Machine & Checkpoints
- Formalise run/step state transitions and enforce via runner + DB constraints.
- Capture checkpoints pre/post major steps and on gate failures; store artifact digests.
- Provide branch/merge APIs to resume work from checkpoints.

## Track B — Session Memory Persistence
- Durable storage for conversation history, workspace snapshots, preferences with TTL + encryption.
- APIs for supervisors to inspect/redact context; alerts before TTL expiry.

## Track C — Diff & RCA Utilities
- Endpoint GET /runs/:id/checkpoints/:checkpointId/diff returning structured diffs.
- RCA bundles aggregating logs, metrics, checkpoints, gate verdicts, resource usage.
- CLI helper to download RCA bundles.

## Track D — Metrics & SSE
- Extend Prometheus exposure with queue latency histograms, handler CPU/memory, approval counts, sandbox usage.
- Typed SSE stream sharing event bus schemas; replay API with pagination/search.

## Track E — LLM Review Gate
- Implement gate:llm_review using MCP GitHub to post line-level comments.
- Provide sample workflow .github/workflows/nofx-llm-review.yml and documentation.
- Store review artifacts and allow rerun/resolution tracking.

---

## Deliverables
- State machine + checkpoints + session memory make automation resumable and debuggable.
- Observability endpoints and typed SSE streams enable dashboards.
- LLM review gate integrates AI feedback into CI.

## Exit Checklist
- [ ] State machine enforced; checkpoints/branching/diff working end to end.
- [ ] Session memory persists and can be inspected/redacted.
- [ ] Metrics/SSE expose typed events and feed Prometheus/clients.
- [ ] LLM review gate documented with working sample workflow.

## Solo Workflow & Tests
1. **Track A** – state machine + checkpoints. Run: npm run test -- --runInBand tests/integration/checkpoints.test.ts.
2. **Track B** – session memory store. Run: npm run test -- --runInBand tests/unit/sessionMemory.test.ts.
3. **Track C** – diff/RCA utilities. Run: npm run test -- --runInBand tests/unit/rcaBundles.test.ts.
4. **Track D** – metrics/SSE. Run: npm run test -- --runInBand tests/unit/eventStream.test.ts, then npm run gates.
5. **Track E** – LLM review gate. Run: npm run test -- --runInBand tests/integration/llmReviewGate.test.ts and exercise the sample GitHub workflow in dry-run mode.

Complete the exit checklist once every track and test passes.

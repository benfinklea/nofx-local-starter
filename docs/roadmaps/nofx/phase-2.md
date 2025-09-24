# 🔐 NOFX Control Plane · Phase 2 — Safety & Sandbox Foundations

> Goal: harden runtime execution so every step is observable, rate limited, recoverable, and sandboxed when needed.

---

## Track A — Typed Event Bus & Hooks
- Implement src/lib/eventBus.ts with typed emit/subscribe/waitFor helpers.
- Refactor src/lib/events.ts and src/worker/runner.ts to publish step lifecycle events through the bus.
- Add pre/post/error hook manager so policies, metrics, and transforms can run outside handlers.
- Emit Prometheus counters for hook executions, event types, validation failures, exposed via /metrics.
- Tests: schema enforcement, hook ordering, waitFor timeouts.

## Track B — Runtime Guardrails
- Enforce NON_INTERACTIVE_MODE defaults, disable restart watchers in headless contexts, log conflicts once.
- Secure admin routes with INTERNAL_API_KEY + RBAC and attach correlation IDs to every log entry.
- Add rate limiting/body-size checks to /runs and automation endpoints.
- Expand audit trail to capture who invoked gated tools or mutated registries.

## Track C — Failure Containment
- Add per-handler circuit breakers, retry backoff, and step_dlq for poison messages (with CLI/API to inspect and requeue).
- Monitor queue depth with backpressure triggers and alerts.
- Nightly smoke tests to ensure validation queue survives bulk updates.

## Track D — Execution Drivers & Sandboxes
- Define execution drivers (local | container | e2b | modal) configurable per step.
- Containerized driver handles lifecycle, resource caps, and cleanup cron (patterned after Async-Code + VibeKit connectors).
- Update bash/heavy handlers to honor execution driver choice and report usage metrics.

## Track E — Zero-Config Bootstrap
- Create scripts/bootstrap-dev.sh that prepares .env, registers default MCP servers, installs hooks, and runs validation.
- Document the rapid onboarding flow in README_LOCAL and AI_CODER_GUIDE.

---

## Deliverables
- Typed event bus with hook pipeline around each step.
- Rate limiting, DLQ/circuit breakers, and audit logs to contain failures.
- Sandbox execution drivers enabling isolated environments.
- Zero-config bootstrap for new contributors.

## Exit Checklist
- [ ] Event bus + hooks wired through runner, emitting metrics and structured events.
- [ ] Rate limits, audit logging, and DLQ/circuit breaker flows active.
- [ ] Sandbox execution drivers available with cleanup + monitoring.
- [ ] Bootstrap script documented; CI verifies validations still pass.

## Solo Workflow & Tests
1. **Track A** – implement the event bus/hooks. Run: npm run lint, npm run typecheck, npm run test -- --runInBand src/lib/eventBus.spec.ts
2. **Track B** – add guardrails. Run: npm run lint, npm run test -- --runInBand tests/unit/guardrails.test.ts
3. **Track C** – add DLQ/circuit breaker. Run: npm run test -- --runInBand tests/unit/dlq.test.ts, then npm run gates
4. **Track D** – wire execution drivers. After manual sandbox smoke test, run: npm run test -- --runInBand tests/integration/executionDrivers.test.ts
5. **Track E** – finish bootstrap docs/script. Final sweep: npm run lint, npm run typecheck, npm run test -- --runInBand

Check the exit list only when all steps pass.

# NOFX Control Plane

## Purpose
The control plane is the orchestration layer that turns human or system requests into durable, auditable execution runs. It normalizes incoming plans, persists them, schedules work on the queue, tracks lineage, and streams updates to any surface (UI, CLI, Slack bots, downstream services).

## Core Capabilities
- **Run creation & planning** – Accepts structured plans or builds them from natural-language prompts before persisting them `src/api/main.ts`, `src/api/planBuilder.ts`.
- **Step execution pipeline** – Applies idempotency, dependency, and policy checks before invoking the correct handler so each step runs exactly once `src/worker/runner.ts`.
- **Tool ecosystem** – Ships with handlers for automated gates, LLM-powered code generation, Git PR automation, database writes, and manual approvals. New tools drop in under `src/worker/handlers`.
- **Observability & audit trail** – Emits structured events for every transition (`run.created`, `step.enqueued`, `step.started`, `step.finished`, etc.), exposes SSE streams, logs usage/cost telemetry, and supports rollback via the responses archive `src/lib/events.ts`, `src/services/responses/*`.
- **Flexible storage & queuing** – Runs on either filesystem or Postgres storage (`DATA_DRIVER`), supports Redis/BullMQ or other adapters for queueing (`QUEUE_DRIVER`), and can fall back to inline execution when no worker is available `src/lib/store.ts`, `src/lib/queue`.

## Run Lifecycle
1. **Request** – Clients POST a plan or plain-language prompt to `/runs`; the API optionally builds gate + work steps and writes the run/step rows `src/api/main.ts`.
2. **Persist + event** – The run is stored (with idempotency keys per step) and a `run.created` event is recorded for the audit timeline.
3. **Enqueue** – Steps are enqueued on the `step.ready` topic with backpressure controls. The system records `step.enqueued` and, if needed, schedules inline execution to avoid lost work `src/api/main.ts`.
4. **Dispatch** – The worker marks each step as running, checks policies/dependencies, and invokes the matching handler `src/worker/runner.ts`.
5. **Tool execution** – Handlers execute work (LLM calls, gate scripts, manual approvals, Git operations, etc.), store outputs/artifacts, and emit telemetry. Example: the `codegen` handler routes through the model router and uploads artifacts to Supabase Storage `src/worker/handlers/codegen.ts`.
6. **Completion** – Once all steps finish, the run is marked `succeeded`; failures propagate `run.failed` events with context. Timelines remain queryable via REST or SSE.

## Tooling & AI Integration
- **AI steps** – Adding a `codegen` (or other LLM) step automatically routes the request through the model router, which selects providers/models, handles retries, and caches responses `src/models/router.ts`.
- **Verification gates** – Built-in gate handlers run lint/typecheck/tests/security checks before downstream work, ensuring AI-generated changes meet quality bars.
- **Manual approvals** – Add `manual:*` steps to pause execution until a human approves, keeping risky operations gated.
- **Custom tools** – Implement the `StepHandler` interface (`match`, `run`) and place the module in `src/worker/handlers`; the loader auto-registers it.

## Building Apps On Top
- **API surface** – Use `POST /runs`, `GET /runs/:id`, `GET /runs/:id/timeline`, and `GET /runs/:id/stream` to drive custom front-ends or integrations. Runs expose linked steps, artifacts, and events so you can render timelines or trigger follow-up actions.
- **Plan templates** – Define reusable plan builders for your product (e.g., automation flows, agent tasks) that mix AI work with verification and deployment steps.
- **Artifact consumption** – Artifacts saved via handlers are available through Supabase Storage or the API, letting apps pull generated files, summaries, or test evidence.
- **Observability hooks** – Subscribe to SSE or ingest emitted events/logs to update dashboards, send notifications, or trigger alerting.

## Safety, Policy, and Reliability
- **Idempotency everywhere** – Steps use idempotency keys; inbox/outbox guards prevent duplicate execution and keep queue delivery reliable `src/lib/store.ts`, `src/worker/runner.ts`.
- **Policy enforcement** – Optional per-step allowlists and secret scopes deny unsafe tool usage ahead of execution.
- **Backpressure & retries** – Queue depth monitoring adds delays when workers lag, and handlers can re-enqueue steps after dependency failures.
- **Audit-ready** – Events, artifacts, and run state are durable for rollback, replay, and compliance checks. Backup tooling persists snapshots under `local_data/`.

## API Documentation

The control plane provides comprehensive API documentation for developers:

- **[API Reference](./API_REFERENCE.md)** - Complete endpoint documentation with request/response formats
- **[Integration Guide](./INTEGRATION_GUIDE.md)** - Step-by-step integration patterns and client examples
- **[OpenAPI Specification](./openapi.yaml)** - Machine-readable API specification
- **[Postman Collection](./nofx-control-plane.postman_collection.json)** - Ready-to-use API testing collection
- **Interactive API Explorer** - Visit `http://localhost:3000/api-docs` for Swagger UI

## Integration Checklist
1. Confirm required queue/storage env vars (`QUEUE_DRIVER`, `DATA_DRIVER`, provider API keys).
2. Define the plan template your app will trigger and verify gate coverage.
3. Implement or import necessary handlers under `src/worker/handlers`.
4. Wire client code to create runs and listen for timeline updates.
5. Validate safety controls (policies, manual gates) and observability before rollout.

Refer to `docs/workstreams/Hardening Plan/HARDENING_PLAN.md` for the long-term hardening roadmap covering reliability, observability, policy, and performance milestones.

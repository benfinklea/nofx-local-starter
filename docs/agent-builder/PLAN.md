# Agent Builder Roadmap — Responses API Retrofit

_Last synced with Context7 Responses docs on 2025-09-18._

> **Guiding Principle**: Preserve our documentation/interaction archive. Every Response run must continue to emit structured events that we persist so users can roll back to any prior state. All migration tasks must prove parity (or an improvement) for that feature before shipping.

## Phase 0 — Platform Retrofit (Active Sprint)
**Objective**: Lay the groundwork to call the Responses API while keeping our existing back-plane reliable and audit-friendly.

### Workstreams
- **Canonical request contract**
  - Produce TypeScript typings + sample payloads covering `model`, structured `input` items, optional `conversation`, `instructions`, `metadata`, `service_tier`, truncation strategy, `parallel_tool_calls`, `reasoning`, and tool manifests.
  - Document default vs. tenant-overrides in `docs/agent-builder/RESEARCH_NOTES.md`.
  - Add request/response diff tests against recorded cassettes to ensure backwards compatibility as we iterate.
- **Persistence mapping**
  - Decide when to store OpenAI `conversation` ids vs. running stateless (`store:false`, `previous_response_id`).
  - Extend Postgres schema: `responses_runs` (core record), `responses_events` (streaming deltas), `conversation_snapshots` (point-in-time reconstructions).
  - Implement cleanup jobs for vendor-side conversations we create.
- **Streaming event router**
  - Define SSE/WebSocket wrapper that normalizes `response.*`, `response.output_text.*`, `response.output_audio.*`, `response.function_call_arguments.*`, `response.file_search_call.*`, `response.mcp_call.*`, `error`, and reasoning events.
  - Establish resume protocol using `sequence_number` + `starting_after` and write conformance tests with mocked streams.
  - Guarantee that every delta is persisted in `responses_events` for rollback.
- **Lifecycle orchestration**
  - Update worker contract for `background:true` runs, `POST /responses/{id}/cancel`, and webhook ingestion (`response.completed|failed|incomplete|cancelled`).
  - Add retry + idempotency guards keyed on OpenAI `id` + `x-request-id`.
  - Demonstrate parity of our documentation feature by replaying stored events into a historical timeline.
- **Rate-limit telemetry (stretch)**
  - Capture `x-ratelimit-*`, `openai-processing-ms`, and `x-request-id` into observability; emit alerts when thresholds approach exhaustion.

### Exit Criteria
- New request typings merged and referenced in gateway + worker code.
- Event router publishes to the existing documentation archive schema with passing integration tests.
- Feature flag enabled for internal tenants to exercise Responses API without regression to rollback tooling.

## Phase 1 — ResponsesRun Service & Interaction Model
**Objective**: Replace bespoke orchestration with a reusable service that drives requests, streaming, documentation archival, and tool execution.

### Workstreams
1. **Request Builder & Tool Registry**
   - Implement `ResponsesRun` TypeScript module handling request validation, JSON schema enforcement for custom tools, and built-in tool adapters (web, file, code interpreter, computer use, MCP).
   - Support `max_tool_calls`, `parallel_tool_calls`, `tool_choice`, and tool refusal fallbacks with retry/abort logic.
   - Emit a canonical run object that includes: request config, OpenAI response metadata (`usage`, `service_tier`, `prompt_cache_key`), status, errors, plus pointers to archived events.
2. **Streaming UX + Documentation Archive**
   - Build buffering utilities that aggregate deltas into stitched assistant messages, while also persisting raw events to the archive for point-in-time restore.
   - Extend notifier pipeline (in-app, email, push) to consume buffered updates; log reasoning summaries (`response.reasoning_summary_part.*`) and refusal text when present.
   - Provide an API to reconstruct conversation state from persisted events so the UI can render arbitrary rollback points.
3. **Memory & State Strategy**
   - Define heuristics for replaying history vs. using vendor conversations per tenant.
   - Codify truncation safeguards, warn when `truncation:"disabled"` plus large history will exceed context window, and auto-prune oldest events when needed (while still retaining archived data for rollback).

### Exit Criteria
- `ResponsesRun` exposed to API layer with full unit/integration coverage.
- UI can play back a historical timeline generated solely from the new event pipeline.
- Tool executions are observable and recoverable via the archive (entry + exit events stored).

## Phase 2 — Builder Surfaces & Templates
**Objective**: Give internal operators and early adopters a safe way to design and deploy workflows on top of the new run service.

### Workstreams
- **No/low-code builder** that compiles to validated `ResponsesRun` configs, including guardrails and safety identifiers.
- **Template catalog** with seeded run configs, storage schemas, and tool registries (Daily Focus Coach, Meeting Prep, Campaign Tracker).
- **Deployment toggles** for Slack, email digests, and in-app channels pulling from the same archived timeline.
- **Rollback tooling**: expose time-travel UI built on `conversation_snapshots` + `responses_events` so operators can revert user-facing state.

### Exit Criteria
- Builder persists configs that are immediately consumable by the run service.
- Operators can roll back any template-derived workflow via the archive UI.
- Channel integrations read from the shared archive without duplication of business logic.

## Phase 3 — Reliability, Analytics, Governance
**Objective**: Harden operations, visibility, and compliance while maintaining the documentation archive as a first-class artifact.

### Workstreams
- **Rate-limit dashboards** using captured telemetry; expose per-tenant token budgets and alert thresholds.
- **Retry & incident flows** for `response.failed` / `response.incomplete`, with archived evidence for audits.
- **Safety instrumentation**: track refusals, hash `safety_identifier`, store moderator review notes aligned with archived runs.
- **Archive retention policies**: define storage duration, tiering to cold storage, and export tooling while ensuring rollback remains instant for active projects.
- **Distributed tracing & observability**: propagate trace/span context through the gateway, worker, and archive pipeline so replay, retry, and cost attribution can be analysed end-to-end.

### Exit Criteria
- Ops dashboards live with drill-down to archived events.
- Compliance can reconstruct any incident via the archive within minutes.
- SLA/SLO defined for archive writes and rebuilds.
- Trace IDs and cost metrics shown per tenant/workflow.

## Phase 4 — Multimodal & Advanced Tooling
**Objective**: Extend beyond text, add advanced orchestration, and maintain robust archival/rollback stories.

### Workstreams
- **Speech loops**: ingest `input_audio`, choose server-VAD vs. manual buffering, archive audio deltas for playback and rollback.
- **Image workflows**: capture image inputs/outputs, store URL references + metadata in the archive, and support creative review rollback.
- **Multi-agent delegation** via MCP or internal tool chaining; each delegation step writes to the timeline with lineage info.
- **Analytics layer**: productivity metrics, alert adherence, persona-specific token/latency stats—all driven off archived events.

### Exit Criteria
- Multimodal runs archived with parity to text workflows.
- Delegation lineage visible in archive explorers.
- Analytics dashboards sourcing exclusively from archived data.

## Phase 5 — Testing, Security, and Data Governance
**Objective**: Formalise resilience, privacy, and tenancy guarantees before the UI overhaul so the platform scales safely.

### Workstreams
- **Performance & Resilience Testing**
  - Integrate load and soak tests for streaming (high-concurrency SSE/WebSocket scenarios) into the gates.
  - Schedule chaos experiments (API outages, broker failures, delayed webhooks) and document expected recovery playbooks.
  - Create migration validation suites that diff legacy vs. Responses runs, guaranteeing functional parity for archived timelines.
- **Rollback Granularity & Storage Strategy**
  - Support partial rollbacks (individual tool executions or conversation segments) alongside full-run restores.
  - Define conflict-resolution rules when multiple operators modify the same workflow simultaneously.
  - Implement hot/warm/cold retention tiers, cost monitoring, and automated pruning with ADRs capturing each decision.
- **Security & Privacy Controls**
  - Classify and scrub PII within archived events; enforce encryption-at-rest and in-flight for sensitive payloads.
  - Document data residency constraints and per-tenant storage locations.
  - Introduce fine-grained access controls / audit logs for archive viewers.
- **Multi-tenancy & Billing Observability**
  - Guarantee tenant isolation across storage, queues, and run orchestration.
  - Allow tenant-specific model catalogs and safety policies.
  - Feed usage and cost attribution (tokens, latency, storage) into billing systems and dashboards.
- **Developer Experience & Knowledge Base**
  - Publish guides for running locally with the stubbed Responses API and debugging event streams.
  - Establish ADR cadence for major architectural choices (retention, security posture, tooling migrations).
  - Maintain migration checklists for workflow authors adapting to the new run service.

### Exit Criteria
- Load/chaos suites run as part of CI or scheduled health checks with documented SLOs.
- Archive supports partial rollbacks, conflict handling, and tiered retention with ADRs recorded.
- Security/privacy policies (PII handling, encryption, residency) enforced and audited.
- Tenant isolation, billing feeds, and per-tenant analytics operational.
- Developer documentation (local mock, debugging, ADR index) published and maintained.

## Phase 6 — UI Modernization & Design System Adoption
**Objective**: Replace the ad-hoc EJS + handcrafted CSS layouts with a cohesive, accessible design system (Material UI) while preserving existing functionality and the documentation archive workflows.

### Workstreams
- **Information Architecture & Audit**
  - Catalogue every rendered surface (`src/ui/views/*.ejs`, `/dev` routes, builder admin, responses explorer) noting required data bindings, auth requirements, and archived timeline integrations.
  - Identify obsolete templates and consolidate redundant views to minimise migration scope.
  - Document layout pain points (breakpoints, font scaling, inconsistent spacing) with annotated screenshots to guide redesign priorities.
- **Design System Selection & Foundations**
  - Confirm Material UI (MUI) as the baseline component library; lock target version and theming strategy (light/dark, tenant overrides, type ramp).
  - Define global tokens for colour, typography, spacing, shadows, and motion that map cleanly onto MUI’s theme system.
  - Create accessibility checklist (WCAG 2.2 AA) including keyboard navigation, focus states, and colour contrast budgets.
- **Architecture Plan**
  - Decide on the client framework (React + Vite) and hosting strategy (co-located with API via Vite SSR, dedicated frontend build, or hybrid).
  - Specify routing/auth patterns to replace server-rendered EJS (e.g., React Router with shared session cookies, or BFF endpoints for data fetching).
  - Outline migration path for shared utilities (formatters, archive playback helpers) so they can be consumed by the new client without duplicating logic.
- **Rollout Strategy**
  - Design feature-flag and kill-switch strategy so individual React/MUI surfaces can be enabled per tenant/role and rolled back instantly.
  - Instrument telemetry to compare legacy vs. new flows (conversion, latency, error rate) and support optional A/B evaluations.
- **Prototype & Tooling**
  - Develop a proof-of-concept page (Responses run detail) using MUI to validate build tooling, linting, and Storybook integration.
  - Establish lint/test tooling for the new stack (ESLint with MUI plugin, React Testing Library, visual regression harness) and add to gates.
  - Document deployment pipeline (CI build step, asset hosting, cache-busting strategy) without disturbing existing API deployments.

### Exit Criteria
- React/MUI foundation (theme, layout primitives, routing skeleton) lives alongside the current EJS stack without breaking legacy flows.
- Design tokens + accessibility checklist ratified in docs, with Storybook entries for core atoms (buttons, typography, cards, timeline events).
- PoC page demonstrates parity with existing Responses run timeline, including archived event playback, and passes new UI test suites.
- Feature flags, telemetry, and rollback levers in place for the first React/MUI screens.

## Phase 7 — Progressive Migration & Layout Harmonisation
**Objective**: Roll the MUI-based experience out across the application, ensure responsive layouts, and retire legacy templates safely.

### Workstreams
- **Incremental Page Migration**
  - Prioritise high-touch screens (dashboard, Responses explorer, builder editor) and migrate them to React/MUI, keeping URLs stable.
  - Implement shared layout shells (navigation, sidebars, footer) with responsive breakpoints tested across desktop/tablet/mobile.
  - Build reusable timeline/rollback components that consume archived events and replace ad-hoc markup.
- **Controlled Rollout & Feedback Loops**
  - Use feature flags and phased tenant cohorts to release updated screens gradually and collect UX telemetry.
  - Provide fallbacks to legacy EJS views if a React route fails health checks.
  - Enable optional A/B or shadow modes to validate behavioural parity before full cutover.
- **Quality & Performance Assurance**
  - Expand Jest/RTL suites to cover migrated pages, add Cypress/Playwright smoke tests for cross-browser sanity, and integrate Lighthouse performance budgets into CI.
  - Ensure analytics, error reporting, and feature flags instrument the new UI and remain aligned with existing observability dashboards.
  - Run accessibility audits (axe-core, manual keyboard testing) before each rollout tranche and track remediation tasks.
- **Decommissioning & Change Management**
  - Maintain a migration tracker documenting pages retired, outstanding gaps, and rollback plans if a React surface needs to fall back to EJS.
  - Provide operator documentation and video walkthroughs covering the new UI workflows, emphasising where archived documentation timelines live.
  - Remove unused EJS templates, CSS assets, and build steps once parity is reached, updating deployment scripts accordingly.

### Exit Criteria
- All user-facing surfaces delivered through the React/MUI stack with consistent theming, responsive layouts, and accessibility sign-off.
- Legacy EJS templates and CSS removed from the build; deployment pipeline simplified to the new front-end bundle.
- Documentation updated (playbooks, runbooks, onboarding) reflecting the modernised UI and its interaction with the documentation archive.
- Feature-flag telemetry confirms successful adoption with rollback levers tested.

## Immediate Actions (Sprint Backlog)
1. Land the expanded request typings + examples and link them from developer docs.
2. Create migrations for `responses_runs`, `responses_events`, and `conversation_snapshots`, then wire the gateway to write into them.
3. Prototype SSE streaming with mocked events, verifying buffering + archive persistence + rollback playback.
4. Draft acceptance tests ensuring the documentation feature (rollback timeline) works end-to-end using the new pipeline.

## Open Questions
- How aggressively should we prune live conversation context while retaining archival fidelity for rollback?
- Which events require synchronous persistence vs. asynchronous batching without risking data loss for rollbacks?
- What governance do we need to let tenants export archived timelines without leaking sensitive metadata?

When these sections are completed and the exit criteria satisfied, we will be ready for production migration off the legacy stack.

# NOFX Control Plane – Feature Ideas From Claude Code Ecosystem

This report surveys selected Claude Code–adjacent projects and extracts concrete features we can adopt. Items are grouped by effort: Low Hanging Fruit, Good to Have, and Hard but Good. For each, I note whether it belongs in the control plane (backend orchestration) or the app layer (UI/CLI tooling), plus any reusable code/licensing notes.

Sources reviewed
- nishimoto265/Claude-Code-Communication (tmux multi-agent demo) – MIT
- rizethereum/claude-code-requirements-builder (requirements workflow) – MIT
- lst97/claude-code-sub-agents (33 subagents + MCP config) – MIT
- x1xhlol/system-prompts-and-models-of-ai-tools (prompt packs) – no license observed (treat as reference)
- musistudio/claude-code-router (model router/proxy + UI) – MIT (npm: @musistudio/claude-code-router)
- winfunc/opcode (desktop GUI for Claude Code) – AGPL-3.0 (don’t copy code; patterns only)
- SuperClaude-Org/SuperClaude_Framework (commands/agents framework) – MIT
- hesreallyhim/awesome-claude-code (curation) – various; reference only
- wshobson/agents (83 subagents) – MIT
- coleam00/context-engineering-intro (PRP workflow template) – MIT
- davila7/claude-code-templates (template installer + analytics) – MIT

Executive summary
- Near-term wins: seed a “subagent + template” registry, add a structured Requirements/PRP run type with 2-phase yes/no gates, and enhance our model router with tiered routing, provider transforms, and basic UI/CLI overrides. All map cleanly to our existing `planBuilder`, `runner`, and `models/router` architecture.
- Medium-term: introduce multi-agent orchestration (auto-delegation by task), run checkpoints/branching with diffs, a template import mechanism, and GitHub Actions triggers.
- Longer-term: full analytics dashboards, deep router/proxy surface, hierarchical agent hierarchies, and real-time session viewers (best suited to the app layer).

Low hanging fruit (1–2 sprints)
1) Subagent presets and prompt packs
- What: Curate/import domain-specific agent definitions (wshobson/agents, lst97/claude-code-sub-agents) and expose them as selectable run “personas” or step handlers.
- Where: Control plane: ship a default agent registry (e.g., `packages/shared/agents.json`) referenced by `src/api/planBuilder.ts`. App layer: selector in UI and a CLI flag.
- Reuse: MIT-licensed agents can be vendored (attribute source). x1xhlol repo is reference-only; don’t copy text.

2) Model router improvements (tiers + overrides)
- What: Map tasks to model tiers (haiku/sonnet/opus analogs) and add per-run override (like CCR’s `/model`). Add long-context routing and a “background/think/docs” profile.
- Where: Control plane: extend `src/models/router.ts` to support tiered `llm.order` and simple heuristics (`longContextThreshold`, `background` profile). App: optional settings UI.
- Reuse: Patterns from musistudio/claude-code-router README; do not copy opcode code (AGPL).

3) Provider transformers (request/response shaping)
- What: Lightweight “transformer” hooks for provider-specific quirks (tool schemas, max tokens, reasoning flags) before calling providers.
- Where: Control plane: add optional transform pipeline in `routeLLM`/provider adapters. App: none.
- Reuse: CCR’s transformer concept; implement in our TypeScript style.

4) Requirements gathering run type (two-phase yes/no)
- What: A run that asks 5 discovery yes/no questions, analyzes code, then 5 expert yes/no questions, producing a Requirements spec artifact.
- Where: Control plane: new handler `requirements:*` with artifacts persisted via `src/lib/store.ts`. App: a simple UI/CLI wizard.
- Reuse: rizethereum flow/commands (MIT) as copyable templates; adapt file layout to our artifacts table.

5) PRP (Product Requirements Prompt) generation and execution
- What: Generate a PRP document from INITIAL.md-like input and execute it as a plan with gates.
- Where: Control plane: handler `prp:generate` (doc artifact) + `prp:execute` (plan execution via `runner`). App: “Generate PRP” and “Execute PRP” buttons.
- Reuse: coleam00 template structure (MIT) for PRP format; keep content generic and project-aware.

6) Basic logging improvements, non-interactive mode, API key guard
- What: Split server-level vs application-level logs; add `NON_INTERACTIVE_MODE` to disable TTY assumptions; allow an internal API key for router-like admin endpoints.
- Where: Control plane: `src/lib/logger.ts`, env handling, optional admin routes; App: none.
- Reuse: Patterns from CCR README.

7) MCP-aware defaults
- What: Recommend a default set of MCP servers (Context7, sequential-thinking, playwright, filesystem) and reflect their availability in run planning.
- Where: Control plane: detection hook in planBuilder to prefer “docs” tasks via Context7; App: docs and setup helpers.
- Reuse: lst97 and SuperClaude lists; we already integrate Context7 in our agent ops.

Good to have (next phase)
1) Multi-agent orchestration and auto-delegation
- What: Dispatch tasks to specialized subagents based on intent; coordinate hand-offs and reviews.
- Where: Control plane: orchestration logic in `planBuilder` + `runner` hooks to route steps by “agent role”; App: visual agent graph.
- Reuse: Agent catalogs (MIT); SuperClaude command taxonomy for role names.

2) Run checkpoints, branching, and diffs
- What: Snapshot run state/outputs, branch runs, and view diffs between checkpoints.
- Where: Control plane: new `checkpoint` entity + artifact snapshots; App: timeline UI and diff viewer.
- Reuse: Concept from opcode; avoid AGPL code.

3) Template registry and installer
- What: Import remote templates (agents, commands, CLAUDE.md fragments) into a project; version and audit them.
- Where: Control plane: template ingestion endpoints and storage; App: a small “template browser”.
- Reuse: davila7/claude-code-templates (MIT) as a catalog reference; don’t depend on external service at first.

4) GitHub Actions / CI triggers
- What: Start NOFX runs from CI (requirements, PRP execute, gates) with non-interactive settings.
- Where: Control plane: tokened CI endpoints + webhooks; App: example workflows.
- Reuse: CCR’s non-interactive and secret-handling patterns.

5) Model router UI overlay
- What: Simple UI to view effective routing order, per-task profile, and active providers.
- Where: App layer.
- Reuse: CCR’s `ccr ui` concept; we implement minimal read-only first.

Hard but good (requires deeper investment)
1) Full router/proxy surface like CCR
- What: Standalone proxy for LLM calls with provider adapters, transformers, UI, and API key multi-tenancy.
- Where: Control plane optional component (or external dependency) + App UI.
- Reuse: Could optionally depend on `@musistudio/claude-code-router` (MIT) as an external service rather than reimplementing.

2) Hierarchical agent execution (President → Boss → Workers)
- What: Structured, hierarchical orchestration with message passing and completion signals.
- Where: Control plane: orchestration engine and messaging events; App: live multi-pane visualization.
- Reuse: nishimoto265 tmux demo as inspiration (MIT); we implement via our queue and events.

3) Advanced analytics and cost insights
- What: Token/cost tracking per provider, run, step, and agent; trends and budgets.
- Where: Control plane: metrics + persistence; App: dashboards.
- Reuse: opcode and claude-code-templates analytics patterns; instrument `models/providers/*` calls.

4) Real-time conversation monitor and remote access
- What: Stream model interactions and status to web/mobile, optionally via secure tunnel.
- Where: Control plane: SSE or websockets for event relay; App: a live log view.
- Reuse: claude-code-templates conversation monitor idea; our `src/worker/relay.ts` can emit streams.

5) E2E test orchestration via MCP (Playwright)
- What: Drive Playwright MCP for UI validation stages during run gates.
- Where: Control plane: a `gate:e2e` handler that calls MCP; App: dashboards.
- Reuse: lst97 MCP config and SuperClaude integration points.

App layer vs control plane – quick map
- Control plane (backend):
  - Model router tiers, transformers, caching, non-interactive flags
  - Requirements/PRP run types, gates, and artifact persistence
  - Multi-agent dispatch in `planBuilder` + `runner`
  - Checkpointing, branching, diff artifacts
  - Template ingestion endpoints and storage
  - CI-safe, tokened endpoints; metrics collection

- App layer (frontend/CLI):
  - Agent/Template browsers and import flows
  - Model routing UI and overrides per run
  - Requirements and PRP wizards
  - Run timelines, checkpoint/diff viewer
  - Analytics dashboards and live conversation monitor

Concrete reuse opportunities (licenses noted)
- Agent libraries (MIT): wshobson/agents, lst97/claude-code-sub-agents – vendorable prompt files; attribute sources.
- Requirements builder (MIT): rizethereum/claude-code-requirements-builder – copy command flows and adapt file naming into artifacts.
- PRP template (MIT): coleam00/context-engineering-intro – adopt PRP structure and INITIAL.md scaffolding.
- Router (MIT): musistudio/claude-code-router – either depend on their CLI as optional external router or replicate config schema (providers, Router profiles, transformers). Avoid tight coupling; keep our router a first-class citizen.
- Templates CLI (MIT): davila7/claude-code-templates – import ideas for template registry and analytics; don’t depend on their hosted service.
- Avoid copying AGPL code: winfunc/opcode – use patterns only.
- Treat prompt packs without license (x1xhlol) as research material; don’t vendor text.

Suggested implementation plan (phased)
Phase 1 (1–2 sprints)
- Add agent registry and per-run agent selection (seed with 10–15 MIT agents).
- Extend `src/models/router.ts` with:
  - task profiles (codegen/reasoning/docs/background) and tiered model order
  - long-context routing threshold and simple output token caps per profile
  - optional provider transform hooks
- Add `requirements:*` and `prp:*` handlers:
  - requirements: two-phase questions → artifact `requirements/spec.md`
  - prp: generate PRP artifact; execute PRP as a multi-step plan via `runner`
- Introduce `NON_INTERACTIVE_MODE` and split logs (server vs app) in logger.

Phase 2
- Multi-agent orchestration in `planBuilder`: intent classifier → agent role → step handler selection; add review/critique steps.
- Checkpoint entity + snapshot/diff artifacts; SSE event for checkpoints.
- Template ingestion endpoint + signed import format; minimal UI list/install.
- CI/GitHub Actions triggers: tokened endpoints + examples.

Phase 3
- Optional external router support (CCR) behind a feature flag.
- Analytics (token/cost) pipeline and dashboards.
- Playwright MCP `gate:e2e` handler and UI display.
- Hierarchical agent flows and visual orchestration.

Fit with current NOFX architecture
- `src/api/planBuilder.ts`: add agent-aware planning and PRP/requirements entrypoints.
- `src/worker/handlers/*`: add `requirements`, `prp:generate`, `prp:execute`, `gate:e2e`.
- `src/models/router.ts`: implement tiered routing, transformers, long context handling, and per-run overrides.
- `src/lib/events.ts` and `src/lib/observability.ts`: checkpoint events, server/app log split, per-provider metrics.
- Database: add tables for checkpoints and (optionally) templates registry; artifacts can store specs/PRPs.

Risks and mitigations
- Licensing: Respect AGPL (opcode) and unlicensed prompt repos; prefer MIT sources for vendoring.
- Scope creep: Keep router enhancements minimal first; avoid building a full proxy until justified.
- UX debt: Don’t block backend features on UI; expose CLI/HTTP endpoints and add simple UI later.
- Provider drift: Encapsulate per-provider transformers to isolate breakage.

References (local snapshots)
- Raw notes are under `local_data/research/claude-code/raw/` in this repo for traceability.

—

Prepared by: Research pass on 11 repos (see sources). This document is intended to drive a focused backlog for NOFX Control Plane.


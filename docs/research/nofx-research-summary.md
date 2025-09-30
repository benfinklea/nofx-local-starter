# NOFX Control Plane — Multi‑Agent & Orchestration Research Summary (Sep 2025)

This document consolidates findings from analyzing 20 GitHub repositories focused on multi‑agent orchestration, workflow automation, swarm intelligence, developer productivity, testing, and observability. It maps  ideas to NOFX’s architecture and proposes concrete, implementable steps.

Note on code reuse: All patterns below are described for clean‑room re‑implementation. Do not copy AGPL/proprietary code into NOFX. Concepts are attributed; implementations should be original and TypeScript‑first.

## Executive Summary

- Build a typed Event Bus and Hook Pipeline to standardize signals, metrics, and policies around step execution.
- Add directional agent handoffs with session‑scoped activeAgent and a basic collaboration/convergence utility.
- Introduce declarative plan primitives (when, fallback, retry, timeout, triggers) plus optional YAML→plan compiler.
- Offer a deterministic execution mode with activity boundaries, minimal history, and saga compensation for safe rollback.
- Add Human‑in‑the‑Loop (HIL) improvements (approve/waive/deny + comments) and optional LLM quality scan gates.
- Phase‑3: Prototype AFlow‑style plan search (operators + evaluator) and governance/weighted consensus for swarms.

## High‑Value, Immediately Implementable Patterns (≥5)

1) Hookable Execution Pipeline (pre_step | post_step | on_error)
- What: Central registry to run hooks around every step for metrics, policy, transforms.
- Value: Observability and control without modifying handlers.
- Where: src/worker/runner.ts integration; src/lib/hooks/* for infra.

2) Typed Event Bus with waitFor + Metrics
- What: Runtime event channels (emit/on/once/waitFor) with counters and filtered listeners.
- Value: Loose coupling of subsystems, easier tests, SSE/metrics taps.
- Where: src/lib/eventBus.ts; wire through runner and handlers.

3) Directional Agent Handoff + Session State
- What: Explicit agent communication matrix and a standard handoff tool updating `activeAgent`.
- Value: Framework‑agnostic swarm behavior without vendor lock‑in.
- Where: src/lib/agents/{registry.ts,session.ts}; minimal tool contract.

4) Convergence Utilities for Parallel Agents
- What: Collaboration hub to share live summaries and detect convergence (streak/thresholds).
- Value: MassGen‑style parallel search with graceful stop.
- Where: Built on EventBus; src/lib/collabHub.ts (lightweight first).

5) Declarative Plan Primitives (+ YAML Compiler)
- What: Step‑level `when`, `fallback`, `retry`, `timeout`, and event triggers; optional YAML→plan compile endpoint.
- Value: Readable intent and robust recovery; easier external integrations.
- Where: Extend plan schema; add `/plans/yaml` compiler; runner respects conditions and fallbacks.

6) Deterministic Mode + Saga Compensation
- What: Mark activity boundaries, record minimal history, support compensation callbacks.
- Value: Safer long‑running workflows; easier replay/rollback.
- Where: Runner flag + handler annotations; compensation dispatcher.

7) HIL Gate Enhancements
- What: Standard approve/waive/deny outputs and comments persisted with gate results.
- Value: Better human collaboration auditability.
- Where: src/worker/handlers/manual.ts + store.

## Phase‑3 Architecture Improvements (≥3)

- AFlow‑Style Plan Search: Operator registry (Generate/Review/Revise/Test/Ensemble), MCTS prototype, evaluator hooks.
- Governance & Weighted Consensus: RBAC labels, policy hooks at pre_step, weighted vote aggregator for swarms (moderator option).
- External Engine Adapters: Import/export to Hatchet DAGs; execute selected handlers as Temporal “activities” (opt‑in).
- Optional: Execution drivers (local first; container stub) to support isolation and cleanup.

## Reusable Ideas and Snippet Outlines (10+)

- EventBus API outline: emit/on/off/once/waitFor with per‑type counters.
- HookManager: register(type,id,fn,priority); run() returns continue + sideEffects to apply.
- Handoff tool contract: handoff({ to, taskDescription? }) updates `activeAgent` and appends tool message.
- Convergence detector: keep bestScore + streak; threshold→converged after N stable iterations.
- DAG runner: topologically fan‑out/fan‑in in‑process for small graphs.
- Saga helper: execute activities with optional compensations run in reverse order on failure.
- Predicate library: boolean predicates over step/context for `when` execution.
- Retry with exponential backoff: wrapper around promises with capped attempts.
- Git worktree helper: create/remove per‑run worktrees for safe PR/codegen isolation.
- Approval helper: `requireApproval({ runId, stepId })` waiting on a gate decision stream.

(Keep all implementations clean‑room and TypeScript‑first.)

## Integration Guide (Condensed)

- Event Bus: Add `src/lib/eventBus.ts`; replace ad‑hoc emits; expose counters via `/metrics` if available.
- Hooks: `src/lib/hooks/{types.ts,hookManager.ts}`; call pre_step/post_step/on_error inside runner around handler execution.
- HIL Gate: Update `manual` handler to emit/comment and return standardized statuses.
- Handoff/Session: `src/lib/agents/{registry.ts,session.ts}`; register agents/tools and maintain `activeAgent` per run.
- Declarative Plans: Extend schema; add `when/fallback/retry/timeout/triggers`; optional `/plans/yaml`.
- Deterministic Mode: Mark activity boundaries; record minimal I/O; add compensation callbacks.
- Adapters: Hatchet (DAG import/export); Temporal (activity wrapper) as optional integrations.

## External Integration Approaches

- MCP: Use existing MCP servers to provide tools without tight coupling; maintain an adapter to consume tool definitions uniformly.
- GitHub CI: Provide sample workflows for NOFX quality gates (tests green, LLM review) driven by handlers.
- Slack/PagerDuty: Publish alert rules fed by EventBus counters for failure spikes or DLQ growth.

## Human‑AI Collaboration Enhancements

- Approval Flow: Standardize approve/waive/deny outcomes with comment capture and audit.
- Operator Escalation: Provide a “navigate to human” tool enabling agent‑to‑human escalation.
- LLM Quality Gates: Integrate a “quality scan” step (Giskard‑style) emitting a risk report artifact and thresholds.

## Performance & Scaling Strategies

- Backpressure & DLQ: Circuit breakers on noisy handlers; retry with jitter; DLQ with requeue controls.
- Parallel Agents: Share live summaries on EventBus; limit N agents per task; convergence stop reduces waste.
- Isolation: Execution drivers for containerized long‑running tasks with cleanup hooks.
- Persistence: Minimal history in deterministic mode; audit trail remains separate from runtime bus.

## License & Exclusions

- Avoid code copying from AGPL‑3.0 repositories (e.g., claude‑squad) and proprietary sources (e.g., openai/gpt‑5‑coding‑examples). Reimplement cleanly.
- Concepts may be derived; retain NOFX style (TypeScript, 2‑space indent, semicolons).

## Repo‑by‑Repo Highlights (Brief)

- Agency Swarm: Orchestrator→worker flows, directional handoffs, persistence hooks.
- MassGen: Parallel agent collaboration with convergence detection and live updates.
- AFlow: MCTS in a workflow program space; operator library for search.
- Agent Swarm Kit: TS DI for agents/tools, MCP integration, session orchestration, unit‑testable overrides.
- HAAS: Hierarchical governance with policy gates and RBAC‑like controls.
- Hatchet: Postgres‑durable DAGs, durable tasks with history and caching, alerts and dashboard.
- Kestra: Event‑driven and scheduled YAML workflows, task runners (Docker/K8s/cloud), UI + git‑ops.
- Temporal TS SDK: Deterministic workflows, activities, saga compensation, telemetry interceptors.
- Conductor: Workflow DSL, system tasks (HTTP/JQ), dynamic task injection.
- Selinon: Conditional execution, fallback tasks/flows, storage abstraction, migrations without queue purge.
- Micro Agent: Test‑driven micro‑loop for reliable code generation; visual matching mode.
- Potpie: Specialized agents over a code knowledge graph; VSCode/Slack integrations.
- marimo: Reactive notebooks and deterministic execution; git‑friendly python files.
- unsloth: Fast fine‑tuning under memory constraints; RL variants; not core to CP.
- Giskard: LLM quality testing (performance, bias, security) and RAG evaluation toolkit.
- WorfBench: Workflow generation benchmark and structure metrics (node/graph matching).
- Leek: Multi‑broker Celery monitoring with Elasticsearch persistence and Slack notifications.
- SwarmAgent: Social dynamics via weighted decision power; group‑environment communication.
- Water: Framework‑agnostic orchestration with simple Flow.then(task) chaining and Pydantic I/O.
- LangGraph Swarm: Hand‑off tools, active agent tracking, short/long‑term memory via checkpointers/stores.

---

Prepared for NOFX maintainers — focused on minimal, additive, TypeScript‑first integrations that preserve current behavior while enabling multi‑agent orchestration, reliability, and quality gates.

---

## AI‑Executable Implementation Checklist (Do This Now)

Follow these steps exactly. Each step has file paths, minimal code scaffolds, and acceptance criteria. Keep changes additive and TypeScript‑first with 2‑space indentation and semicolons.

1) Add Typed Event Bus (runtime only)
- Files:
  - Create: `src/lib/eventBus.ts`
  - Create test: `tests/unit/lib/eventBus.test.ts`
- Scaffold (paste, then adapt types later if needed):
  ```ts
  // src/lib/eventBus.ts
  export type EventMap = Record<string, unknown>;
  export class EventBus<T extends EventMap> {
    private listeners = new Map<keyof T, Set<(p: any) => void>>();
    private counters = new Map<keyof T, number>();
    on<K extends keyof T>(type: K, cb: (payload: T[K]) => void): () => void {
      const set = this.listeners.get(type) ?? new Set(); set.add(cb as any); this.listeners.set(type, set); return () => this.off(type, cb as any);
    }
    once<K extends keyof T>(type: K, cb: (payload: T[K]) => void): () => void { const off = this.on(type, (p) => { off(); cb(p); }); return off; }
    off<K extends keyof T>(type: K, cb: (payload: T[K]) => void): void { const set = this.listeners.get(type); if (set) set.delete(cb as any); }
    emit<K extends keyof T>(type: K, payload: T[K]): void { this.counters.set(type, (this.counters.get(type) ?? 0) + 1); const set = this.listeners.get(type); if (set) for (const cb of Array.from(set)) cb(payload); }
    async waitFor<K extends keyof T>(pred: (type: K, payload: T[K]) => boolean, opts?: { timeoutMs?: number }): Promise<{ type: K; payload: T[K] }> {
      return new Promise((resolve, reject) => {
        const cleanupFns: Array<() => void> = []; const timeout = opts?.timeoutMs ? setTimeout(() => { cleanup(); reject(new Error('waitFor timeout')); }, opts.timeoutMs) : null;
        const listener = (type: any) => (payload: any) => { try { if (pred(type, payload)) { cleanup(); resolve({ type, payload }); } } catch (e) { cleanup(); reject(e); } };
        for (const key of this.listeners.keys()) { cleanupFns.push(this.on(key, listener(key as any))); }
        const cleanup = () => { for (const fn of cleanupFns) fn(); if (timeout) clearTimeout(timeout); };
      });
    }
    count<K extends keyof T>(type: K): number { return this.counters.get(type) ?? 0; }
  }
  export const eventBus = new EventBus<any>();
  ```
- Tests (Vitest skeleton):
  ```ts
  // tests/unit/lib/eventBus.test.ts
  import { describe, it, expect } from 'vitest';
  import { EventBus } from '../../../src/lib/eventBus';
  describe('EventBus', () => {
    it('emits and receives', () => {
      type E = { hello: { msg: string } };
      const bus = new EventBus<E>();
      let got = '';
      bus.on('hello', (p) => { got = p.msg; });
      bus.emit('hello', { msg: 'world' });
      expect(got).toBe('world');
    });
  });
  ```
- Acceptance: unit test passes; no imports elsewhere yet.

2) Add Hook Pipeline (no‑op by default)
- Files:
  - Create: `src/lib/hooks/types.ts`
  - Create: `src/lib/hooks/hookManager.ts`
  - Create tests: `tests/unit/lib/hooks/hookManager.test.ts`
- Scaffold:
  ```ts
  // src/lib/hooks/types.ts
  export type HookType = 'pre_step' | 'post_step' | 'on_error';
  export interface HookContext { runId: string; stepId: string; tool?: string; inputs?: unknown; output?: unknown; error?: unknown; }
  export interface HookResult { continue: boolean; sideEffects?: Array<() => Promise<void> | void>; }

  // src/lib/hooks/hookManager.ts
  import type { HookType, HookContext, HookResult } from './types';
  export class HookManager {
    private registry: Record<HookType, Array<{ id: string; fn: (c: HookContext) => Promise<HookResult> | HookResult; priority: number }>> = { pre_step: [], post_step: [], on_error: [] };
    register(type: HookType, id: string, fn: (c: HookContext) => Promise<HookResult> | HookResult, priority = 0): void { const arr = this.registry[type]; arr.push({ id, fn, priority }); arr.sort((a, b) => b.priority - a.priority); }
    unregister(type: HookType, id: string): void { this.registry[type] = this.registry[type].filter(h => h.id !== id); }
    async run(type: HookType, ctx: HookContext): Promise<HookResult> { const effects: HookResult['sideEffects'] = []; for (const h of this.registry[type]) { const res = await h.fn(ctx); if (res.sideEffects?.length) effects.push(...res.sideEffects); if (res.continue === false) { await this.apply(effects); return { continue: false }; } } await this.apply(effects); return { continue: true }; }
    private async apply(e?: Array<() => Promise<void> | void>): Promise<void> { if (!e) return; for (const fn of e) await fn(); }
  }
  export const hookManager = new HookManager();
  ```
- Tests: basic registration, priority order, early stop.
- Acceptance: tests pass; not yet wired into runner.

3) Wire Hooks into Runner (minimal, backwards‑compatible)
- File to edit: `src/worker/runner.ts`
- How:
  1. Import `hookManager` and `HookContext`.
  2. Locate the main step execution path (search for: `handler.run(` or the function that executes a step/tool).
  3. Before calling the handler, build `ctx: HookContext = { runId, stepId: step.id, tool: step.tool, inputs: step.inputs }`.
  4. Call `const pre = await hookManager.run('pre_step', ctx); if (!pre.continue) return` (or short‑circuit per your control flow).
  5. After success, call `await hookManager.run('post_step', { ...ctx, output: result })`.
  6. In the catch block, call `await hookManager.run('on_error', { ...ctx, error })` before rethrow/mark failure.
- Acceptance: existing tests remain green; if no hooks are registered, behavior is unchanged.

4) HIL Gate: approve/waive/deny + comment
- File to edit: `src/worker/handlers/manual.ts`
- How:
  - Ensure the handler reads a gate decision object with fields `{ status: 'approved'|'waived'|'denied', comment?: string }` from the store or inputs.
  - Emit outputs including the `comment` back to downstream steps and persist in gate metadata.
  - Standardize return shape so downstream conditions can check status.
- Tests:
  - Add `tests/unit/handlers/manual.test.ts`: approve⇢passes; denied⇢fails; waived⇢continues but marks waived; comment persisted.
- Acceptance: unit tests pass; existing flows unaffected if not using manual gate.

5) Add Convergence Utility (library only)
- File: `src/lib/convergence.ts`
- Scaffold:
  ```ts
  export interface ConvergenceState { streak: number; bestScore: number }
  export function updateConvergence(state: ConvergenceState, score: number, threshold = 0.99): { converged: boolean; state: ConvergenceState } {
    const best = Math.max(state.bestScore, score); const streak = score >= threshold ? state.streak + 1 : 0;
    return { converged: streak >= 3, state: { bestScore: best, streak } };
  }
  ```
- Acceptance: exported utility available; no integration yet.

6) Optional: Metrics Exposure
- If there is an existing `/metrics`, increment counters in a basic metrics hook:
  - File: `src/lib/hooks/metricsHook.ts`
  - Register in startup path (e.g., worker init): increments per hook type and per step.tool.
- Acceptance: starts without errors even if metrics backend is absent.

7) Unit Test Command
- Run: `npm run test` (Vitest) and ensure ≥90% coverage on changed lines.

8) Commit Plan (Conventional Commits)
- feat(core): add typed EventBus with waitFor and counters
- feat(hooks): introduce hook pipeline with pre/post/error stages
- feat(worker): wire hooks into runner (no‑op by default)
- feat(gates): manual gate supports approve/waive/deny with comments
- chore(tests): add unit tests for event bus, hooks, manual gate

9) Rollback Safety
- All new modules are additive. Runner changes are guarded: with zero registered hooks, behavior is unchanged. Manual gate change is backward compatible when decision is missing (default approve path).

10) Next (Optional) Tasks After Merge
- Add `handoff` tool and session store for `activeAgent` (files: `src/lib/agents/{registry.ts,session.ts}`) and a basic tests suite.
- Extend plan schema with `when` and `fallback` (schema + runner checks) and add unit tests.

Acceptance Criteria (Phase‑1 Complete)
- New libs: event bus, hooks, convergence helper landed with unit tests.
- Runner calls hookManager in pre/success/error paths without behavior changes when no hooks registered.
- Manual gate persists comment and standardized status.
- All gates pass locally: `npm run gates` or `npm run test` + `npm run lint` + `npm run typecheck`.

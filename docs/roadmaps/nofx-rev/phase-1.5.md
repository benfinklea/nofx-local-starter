# 🧭 NOFX Control Plane REV · Phase 1.5 — Unified Navigation & Feature Surfacing

> **Goal**: Replace the ad-hoc navigation with a manifest-driven experience so every new capability shipped in Phases 1+2 is immediately discoverable and consistent across web, worker, and CLI entrypoints.

> **Context**: With the agent/template registry now live (Phase 1) and advanced orchestration on deck (Phase 2), teams need a cohesive shell that exposes tooling without bespoke UI work. Phase 1.5 bridges that gap before deeper intelligence rolls out.

---

## 🎯 Parallel Agent Execution Strategy

This bridging phase again employs **3 parallel agents** working on complementary tracks:

- **🤖 Agent Alpha** → Track A (Navigation Framework & Layout Shell)
- **🤖 Agent Beta** → Track B (Feature Registry & Developer Diagnostics)
- **🤖 Agent Gamma** → Track C (Migration, Visual Polish & Telemetry)

Tracks are loosely coupled: Alpha ships the shell, Beta makes features pluggable, Gamma migrates and validates the resulting UX.

### Dependencies
- Phase 1 registry APIs and CLI tooling committed in `main`
- Existing Vercel/Vite frontend build pipeline with shared component library
- Access to all feature docs/specs (registry, runs, ops, observability) for auditing
- Product-led inventory of priority surfaces to expose in nav day one

### Milestone Gate
Advance to Phase 2 only when:
- Manifest-driven navigation renders consistently on desktop, tablet, and mobile
- Every Phase 1 capability appears in the nav with correct permissions and health status
- Analytics dashboards report feature click-through and time-to-task for the new shell
- Rollback plan documented (toggle to original nav) and validated in staging

---

## Track A — Navigation Framework & Layout Shell
**Owner: Agent Alpha**  
**Estimated: 2 weeks | Priority: High**

### Core Deliverables
- **Navigation Manifest Schema**: JSON/YAML definition containing label, path, icon, grouping, permissions, rollout flag, ownership, and related telemetry ids.
- **Nav Composer Library**: Shared TS module (packages/shared) that parses manifest, resolves permissions, and exposes hooks for runtime clients (web, API, CLI).
- **Layout Shell Refresh**: Single source of truth for topbar, sidebar, breadcrumbs, contextual actions, and responsive breakpoints.
- **Manifest Pipeline**: Build step + runtime cache layer to hot-reload nav entries without rebuilds (supporting environment overrides).

### Integration Points
- Respect feature flag service + RBAC claims from existing auth middleware.
- Provide fallbacks for legacy routes while migration completes.
- Expose nav state via `window.NOFX_NAV` for browser extensions and automated tests.

### Testing Strategy
- Unit tests for manifest validation + permission guards
- Visual regression snapshots for shell components
- Contract tests ensuring manifest-required properties are present before deploy

### Exit Criteria
- [ ] Manifest schema versioned and validated (Zod or similar)
- [ ] Nav composer published to shared package with documentation
- [ ] Responsive layout renders 3 breakpoints with parity to design spec
- [ ] Feature flag and RBAC guards proven via automated tests

---

## Track B — Feature Registry & Developer Diagnostics
**Owner: Agent Beta**  
**Estimated: 1.5 weeks | Priority: High**

### Feature Inventory & Registration
- Audit all existing tools (registry CLI, agents/templates dashboards, run operations, observability, billing) and register them in the manifest with accurate ownership and stability tags.
- Introduce `docs/registry` tooling checklist linking documentation, test suites, and environment variables per feature.

### Developer Console
- Build `/dev/navigation` dashboard showing manifest entries, missing routes, and permission mismatches.
- Add CI checks: broken-link detector, permission coverage, and manifest schema validation.
- Provide CLI command (`npm run nav:lint`) to run validations locally before PRs.

### Rollout Safeguards
- Emit structured logs when features are hidden due to permissions or feature flags.
- Add optional “coming soon” badges for entries gated on Phase 2 work.

### Exit Criteria
- [ ] 100 % of Phase 1 features registered with metadata (owner, status, docs, tests)
- [ ] Developer console live with red/yellow/green health indicators
- [ ] CI pipeline fails on orphaned manifest entries or missing routes
- [ ] Team playbook updated with “How to add a nav entry” checklist

---

## Track C — Migration, UX Polish & Telemetry
**Owner: Agent Gamma**  
**Estimated: 2 weeks | Priority: Medium**

### Incremental Migration
- Port builder, runs, observability, and settings views to the new shell using the manifest-based renderer.
- Implement breadcrumb + contextual action patterns so deep pages (run detail, template version) automatically surface in nav.
- Provide keyboard shortcuts (`g` + key) and quick-search palette (e.g., `Cmd+K`) powered by manifest data.

### Analytics & Feedback
- Instrument navigation telemetry: click-through, time-to-feature, bounce rates, and empty states.
- Stand up a feedback widget tied to Linear/GitHub issues for rapid iteration.
- Define SLIs/SLOs for navigation responsiveness (<150 ms render for cached manifest) and monitor via existing observability stack.

### Rollback & Accessibility
- Maintain runtime toggle to revert to legacy nav in staging/production until Phase 2 sign-off.
- Ensure keyboard navigation + screen reader landmarks meet WCAG AA.

### Exit Criteria
- [ ] Legacy nav fully removed post toggle validation
- [ ] Analytics dashboards reviewed with product leads (baseline established)
- [ ] Accessibility audit completed with documented fixes
- [ ] Feedback loop live and feeding into backlog

---

## 🔄 Inter-Track Coordination

### Shared Dependencies
- Manifest schema owned by Track A but consumed by Tracks B/C. Versioning + change notifications required.
- Track B’s developer console relies on telemetry/logging provided by Track C.
- Track C depends on Track B’s manifest entries to migrate pages safely.

### Synchronization Points
- **Week 1 Midpoint**: Manifest schema freeze; Tracks B/C begin registration and migration.
- **Week 2 Start**: Developer console alpha feeds actionable issues to Track C migration.
- **Week 2 End**: Joint UX review with product/research + performance benchmark sign-off.

### Communication Cadence
- Daily standups focused on manifest changes, migration blockers, and telemetry.
- Shared Slack channel `#nofx-nav-revamp` for design/engineering coordination.
- Weekly stakeholder review to demo progress and capture feedback.

---

## 📊 Success Metrics

### Technical Metrics
- Manifest build < 1 s, runtime nav render < 150 ms p90
- 0 nav-related Sentry issues after rollout
- 100 % manifest entries covered by automated validation

### Experience Metrics
- Feature discoverability score (survey) improves by ≥30 %
- Time-to-feature (runs, registry, ops) reduced by ≥40 %
- Navigation NPS > 8/10 from internal stakeholders before Phase 2

---

## 🎯 Phase 1.5 Completion Criteria
- Navigation manifest + composer in production with full Phase 1 coverage
- New shell adopted across top workflows with documented toggle/rollback
- Developer tooling and analytics in place to keep navigation healthy
- UX research sign-off and backlog of follow-ups groomed for Phase 2

---

## 🚀 Next Phase Preview

Phase 2 will leverage the manifest-driven shell to expose multi-agent orchestration controls, intelligent workflow dashboards, and predictive ops tooling. The work in Phase 1.5 ensures those capabilities land in a discoverable, measurable environment ready for rapid iteration.

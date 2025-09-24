# 📡 Zig Todo · Phase 5 — Observability & Review Center

> Goal: visualize checkpoints, session memory, AI review feedback, and run metrics released in NOFX Phase 5.

---

## Track A — Run Timeline & Diff Viewer
- Display checkpoints, branches, and structured diffs.
- Provide quick links to download RCA bundles.

## Track B — Session Memory Inspector
- Show persisted conversation/workspace snapshots; allow redaction or restore requests.
- Respect retention/TTL warnings.

## Track C — LLM Review Dashboard
- Present gate:llm_review comments, allow rerun/resolve, and show GitHub workflow status.
- CLI zig review rerun|resolve for CI integration.

## Track D — Metrics Pane
- Charts for queue latency, handler runtime, approval counts, sandbox usage.
- Export data for reports (CSV/PDF).

---

## Exit Checklist
- [ ] Timeline/diff UI operational with RCA bundle access.
- [ ] Session memory view lets supervisors manage context.
- [ ] LLM review dashboard surfaces AI feedback and rerun tools.
- [ ] Metrics pane feeds leadership reports.

## Solo Workflow & Tests
1. Build timeline/diff, then run: npm run test -- --runInBand tests/ui/runTimeline.test.ts.
2. Implement session inspector, then run: npm run test -- --runInBand tests/ui/sessionInspector.test.ts.
3. Create review dashboard, then run: npm run test -- --runInBand tests/ui/llmReview.test.ts.
4. Add metrics pane, then run: npm run lint, npm run typecheck, npm run test -- --runInBand.

Advance when all tests pass and the exit list is satisfied.

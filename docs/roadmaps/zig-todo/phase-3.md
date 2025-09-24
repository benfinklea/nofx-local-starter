# 📋 Zig Todo · Phase 3 — Backlog & Pack Manager

> Goal: help supervisors curate specs, monitor DLQs, and sync rule packs alongside NOFX Phase 3.

---

## Track A — Backlog Explorer
- List backlog items with filters (priority, automationReady, supervision level).
- Show spec commit references, conflicts, DLQ status, and allow inline notes.

## Track B — Pack Sync UI
- Surface imported Ruler/Rulebook packs, highlight conflicts, and offer approve/ignore actions.
- CLI zig packs sync|status mirroring NOFX helper.

## Track C — Contributor Feedback
- Present validation artifacts for failed specs/packs; allow regenerate/resubmit.
- SSE listener for backlog.updated, pack.synced, pack.conflict.

---

## Exit Checklist
- [ ] Backlog explorer covers spec history and DLQ triage.
- [ ] Pack UI/CLI keeps contributors aware of conflicts.
- [ ] Validation artifacts accessible directly from the tool.

## Solo Workflow & Tests
1. Build backlog explorer, then run: npm run test -- --runInBand tests/ui/backlogExplorer.test.ts.
2. Implement pack sync UI/CLI, then run: npm run test -- --runInBand tests/ui/packSync.test.ts.
3. Add feedback surfaces, then run: npm run lint, npm run typecheck, npm run test -- --runInBand.

Proceed to the next phase after ticking the exit checklist.

# 🐝 Zig Todo · Phase 6 — Hierarchy Console & Mobile Companion

> Goal: monitor hive-mind runs, approve escalations, and control automation from anywhere.

---

## Track A — Hierarchy Visualizer
- Real-time tree showing agent roles, statuses, checkpoints, remediation markers.
- Highlight conflicts or escalations needing human input.

## Track B — Intervention Controls
- Promote/demote agents, abort branches, assign humans with dry-run preview and audit logging.
- Surface auto-remediation suggestions and approval buttons.

## Track C — Mobile / Remote Control
- Secure device sync with encrypted push notifications for approvals, pause/resume, status checks.
- Lightweight mobile web view summarising active runs and alerts.

---

## Exit Checklist
- [ ] Hierarchy viewer synced with NOFX events.
- [ ] Interventions logged and reversible.
- [ ] Mobile notifications/controls available for supervisors on the go.

## Solo Workflow & Tests
1. Build the visualizer, then run: npm run test -- --runInBand tests/ui/hierarchyViewer.test.ts.
2. Add intervention controls, then run: npm run test -- --runInBand tests/ui/interventionControls.test.ts.
3. Implement mobile companion, then run: npm run lint, npm run typecheck, npm run test -- --runInBand.

Proceed once the checklist is complete and manual mobile notification tests succeed.

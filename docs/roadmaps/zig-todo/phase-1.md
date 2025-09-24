# 🧰 Zig Todo · Phase 1 — Catalog & Validation Workbench

> Goal: give contributors an easy way to browse, edit, and validate agents/templates before NOFX ingests them.

---

## Track A — Catalog Views
- Consume NOFX /agents and /templates; show validation status, version, resource profile, quarantine flags.
- Provide filters/search and links to docs for each agent/template.

## Track B — Editors & Draft Flow
- Agent/template editors that write .draft files, manage __bulk_update.lock, and run validation before promotion.
- CLI parity: zig agents new|edit|rollback and zig templates new|edit with schema checks.

## Track C — Contributor Guidance
- Inline docs/tooltips explaining required fields, resource profiles, and rollback steps.
- Telemetry events (agent.edit, template.save) for health dashboards.

---

## Exit Checklist
- [ ] Catalog reflects live registry status with quarantine warnings.
- [ ] Editors enforce draft + validation workflow.
- [ ] CLI commands documented for non-UI environments.

## Solo Workflow & Tests
1. Implement catalog views, then run: npm run test -- --runInBand tests/ui/catalog.test.ts.
2. Build editors + draft flow, then run: npm run test -- --runInBand tests/ui/editorDraftFlow.test.ts.
3. Add guidance + telemetry, then run: npm run lint, npm run typecheck, npm run test -- --runInBand.

Move to Phase 2 once all three steps pass and the exit checklist is satisfied.

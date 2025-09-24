# 📥 NOFX Control Plane · Phase 3 — Backlog Intake & Pack Sync

> Goal: turn committed specs into backlog items, import shared rule packs (Ruler/Rulebook), and keep everything auditable.

---

## Track A — Spec Parser & Ingestion
- Build unified parser for Markdown/JSON specs with required fields (priority, impact, effort, automationReady, supervisionLevel, resourceProfile).
- Worker backlog:ingest with retries, poison-pill detection, and spec_dlq fallback.
- Persist backlog_specs, backlog_items, backlog_links with version history and source commit references.
- Expose /backlog APIs (list/detail/history/import) with pagination + ETag.
- Metrics/alerts for ingestion success, conflicts, DLQ size.

## Track B — Pack Integration
- Detect .ruler/ and .rulebook-ai/ directories; import instructions, MCP configs, tools into registries.
- Flag conflicts when packs override local definitions; require supervisor acknowledgement.
- CLI helper (npm run packs:sync) mirroring Rulebook workflow.

## Track C — Contributor Feedback
- Store validation reports as artifacts per spec/pack so authors can inspect failures.
- Publish backlog.updated, pack.synced, pack.conflict events for clients.
- Document spec/pack workflow, conflict resolution, DLQ usage.

---

## Deliverables
- Backlog populated from specs with dedupe/conflict markers.
- Pack sync pipeline keeping rules/MCP configs aligned.
- Feedback loop so contributors and supervisors know when action is needed.

## Exit Checklist
- [ ] Specs land in backlog tables with history, metrics, and DLQ support.
- [ ] Pack sync imports Ruler/Rulebook content and flags conflicts.
- [ ] CLI/docs help contributors author specs/packs confidently.
- [ ] Events flow to clients for backlog and pack updates.

## Solo Workflow & Tests
1. **Track A** – implement parser + ingestion. Run: npm run test -- --runInBand tests/integration/backlogIngestion.test.ts, then npm run lint.
2. **Track B** – add pack sync. Run: npm run packs:sync (against sample packs), npm run test -- --runInBand tests/integration/packSync.test.ts.
3. **Track C** – document feedback loop and wire SSE events. Run: npm run test -- --runInBand tests/unit/events.test.ts, npm run gates.

Only mark the exit checklist complete once all three tracks and tests succeed.

# 📥 NOFX Control Plane · Phase 3 — Cloud Backlog Intake & Pack Sync

> Goal: convert committed specs into backlog items and sync shared rule packs using Supabase pipelines so everything stays auditable in the cloud.

---

## Track A — Cloud Spec Parser & Ingestion
- Build unified parser for Markdown/JSON specs with required fields (priority, impact, effort, automationReady, supervisionLevel, resourceProfile) and export as Supabase-ready payloads.
- Worker job `backlog:ingest` pulls from Supabase storage (`specs/inbox/`) with retries, poison-pill detection, and `spec_dlq` fallback.
- Persist `backlog_specs`, `backlog_items`, `backlog_links` with version + source commit metadata; store raw documents in Supabase storage for replay.
- Expose `/api/backlog` routes (list/detail/history/import) via Vercel Functions with pagination + `If-None-Match` caching.
- Publish ingestion metrics to Supabase observability schema; alert when DLQ grows or schemas drift.

## Track B — Cloud Pack Integration
- Detect `.ruler/` and `.rulebook-ai/` directories during CI; push canonical packs to Supabase storage along with manifest checksums.
- Cloud pack sync worker imports instructions, MCP configs, and tools into the registries created in Phase 1; conflicts recorded in `pack_conflicts` table with resolution status.
- CLI helper `npm run packs:sync -- --target=cloud` mirrors Rulebook workflow and verifies remote state before finishing.

## Track C — Contributor Feedback & Notifications
- Store validation reports and diff artifacts in Supabase storage with signed URLs for authors.
- Publish `backlog.updated`, `pack.synced`, `pack.conflict` events via Supabase realtime; surface notifications in frontend dashboards.
- Document end-to-end flow including GitHub Action that uploads specs/packs to cloud inboxes and how to clear DLQ items.

---

## Deliverables
- Backlog ingestion pipeline operating fully in Supabase with auditable history and DLQ support.
- Cloud pack sync keeping rule definitions and MCP configs aligned across registries.
- Feedback loop that notifies contributors via Supabase realtime + dashboard updates.

## Exit Checklist
- [ ] Specs land in `backlog_*` tables with history, metrics, and DLQ support stored in Supabase.
- [ ] Pack sync imports Ruler/Rulebook content to Supabase registries and flags conflicts for supervisors.
- [ ] CLI/docs explain how contributors submit specs/packs to the cloud and inspect validation artifacts.
- [ ] Events surface in frontend dashboards using Supabase realtime feeds.

## Solo Workflow & Tests
1. **Track A** – implement parser + ingestion. Run: `npm run test -- --runInBand tests/integration/backlogIngestion.cloud.test.ts`, then `npm run lint`.
2. **Track B** – add pack sync. Run: `npm run packs:sync -- --target=cloud --dry-run`, `npm run test -- --runInBand tests/integration/packSync.cloud.test.ts`.
3. **Track C** – document feedback loop and wire SSE events. Run: `npm run test -- --runInBand tests/unit/events.cloud.test.ts`, `npm run gates`.

Mark the exit checklist only once all three tracks operate against Supabase + Vercel environments.

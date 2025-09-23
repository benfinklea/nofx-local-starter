# Phase 7 Kickoff — Progressive Migration & Layout Harmonisation

_Last updated: 2025-02-04_

## Objectives
- Roll the Material UI shell out across high-touch workflows while keeping legacy EJS fallbacks healthy.
- Harmonise layout primitives (navigation, page chrome, responsive breakpoints) so operators see a consistent experience across the React surfaces.
- Expand automated coverage (React Testing Library, Playwright, Lighthouse) to catch regressions as the migration proceeds.

## Migration Order (Wave 1)
1. **Dashboard (`/ui/runs` ➜ `/ui/app/#/runs`)**
   - Replace the legacy EJS runs table with the existing React list view.
   - Wire feature flag `UI_RESPONSES_UI_MODE=mui` to gate rollout per tenant.
   - Capture parity metrics: run counts, statuses, gating indicators, links to artifacts.
2. **Builder Admin (`/ui/builder`)**
   - Port template list + inline editor to React with shared layout shell.
   - Reuse existing responses runtime hooks for run previews; expose stub mode for local QA.
3. **Operator Settings (`/ui/settings`, `/ui/models`)**
   - Migrate forms to MUI components; ensure auth guard + audit logging remain intact.
4. **Responses Explorer (Already React)**
   - Treat as control group; track telemetry to confirm no regressions after wave 1 routes adopt shared shell.

## Technical Tasks
- Extract shared layout primitives from `Shell` into `components/layout` (top bar, nav, responsive drawer) for reuse across migrated pages.
- Introduce a `RoutesLegacyFallback` helper that proxies to EJS views when feature flags are unset, with health-check logging.
- Expand API client coverage (`lib/api.ts`) with typed endpoints for builder/templates to avoid ad-hoc fetch calls during migration.
- Add Lighthouse CI script (`npm run test:lighthouse`) scoped to `/ui/app/#/runs` and `/ui/app/#/builder` once pages exist.

## Telemetry & Rollout
- Instrument `logUiEvent` with new sources: `runs-index`, `builder-index`, `settings-index` to observe adoption.
- Emit feature-flag toggles to analytics (`ui.migration.phase7.enabled`) for audit trails.
- Schedule weekly review of flag cohorts; maintain rollback checklist in `docs/workstreams/Hardening Plan/04-tests-and-gates.md`.

## Testing & QA
- Extend Vitest suites with coverage for the migrated pages (table filtering, pagination, feature flag redirects).
- Add Playwright smoke flows for `/ui/app/#/runs` and `/ui/app/#/builder` (auth + navigation).
- Update `docs/Testing instructions.md` with React-page walkthrough steps ahead of rollout.

## Risks & Mitigations
- **Backend drift**: Keep API and worker endpoints compatible with both UI stacks; add contract tests before removing legacy views.
- **Accessibility regressions**: Run axe-core audits per wave; capture findings in `docs/ui/a11y-log.md`.
- **Operator training**: Prepare screen captures / 2-minute walkthroughs before flipping tenant flags.

## Next Steps
- [x] Derive migration toggles (`runsReactEnabled`, `builderReactEnabled`, `settingsReactEnabled`) and plumb them through config (`UI_RUNS_UI_MODE`, `UI_BUILDER_UI_MODE`, `UI_SETTINGS_UI_MODE`).
- [ ] Draft PRD for Dashboard migration including acceptance criteria and telemetry requirements.
- [ ] Spin up Playwright project targeting the React shell and integrate into `npm run gates`.
- [ ] Schedule design review of shared layout components with Design Systems working group.

# Agent Guidelines for NOFX Local Starter

Scope: Applies to the entire repository.

Principles
- Keep edits minimal and scoped to the task; avoid unrelated refactors.
- Prefer clarity and reversibility; explain why when offering tradeoffs.
- Use Node 20 and existing npm scripts; no new tooling without confirmation.

Planning & Process
- Use the plan tool for any task with more than one step; keep exactly one step in_progress.
- Share brief progress notes before long-running actions.
- Ask before destructive actions (rm/reset/rewrite history), DB schema changes, or network installs.

Code & Tests
- TypeScript style as in repo; no license headers.
- Do not remove tests; keep unit tests network-free (use mocks in tests/setup.ts).
- Keep changed-lines coverage gate >= 0.90 via `scripts/runGate.js`.

Shell & Files
- Prefer `rg` for search; read files in chunks ≤ 250 lines.
- Follow existing layout: API in `src/api`, worker in `src/worker`, UI in `src/ui`.

CI & Branching
- CI checks are split by gate: typecheck, lint, gate-unit (Vitest), jest-unit.
- Codecov is enabled; keep PR comments off/minimal; rely on status checks.
- Branches: `feat/*`, `fix/*`, `chore/*`. Use Conventional Commits.

Local Running
- Supabase Local for DB/Auth/Storage; Redis for queue.
- Use provided npm scripts (e.g., `dev`, `gates`).


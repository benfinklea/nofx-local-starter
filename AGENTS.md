# Repository Guidelines
> **AI assistants:** Read `AI_CODER_GUIDE.md` before performing any work on this repo. It contains mandatory guardrails.
> **AI assistants:** Read `THE_PHILOSOPHY_OF_NOFX.md` before performing any work on this repo. It contains our high-level goals and market strategy.

## Top Level Instructions
- Work doggedly. Your goal is to be autonomous as long as possible. If you know the user's overall goal, and there is still progress you can make towards that goal, continue working until you can no longer make progress. Whenever you stop working, be prepared to justify why.
- Work smart. When debugging, take a step back and think deeply about what might be going wrong. When something is not working as intended, add logging to check your assumptions.
- Check your work. If you write a chunk of code, try to find a way to run it and make sure it does what you expect. If you kick off a long process, wait 30 seconds then check the logs to make sure it is running as expected.

## Project Structure & Module Organization
The Node 20 backend lives in `src/`: `src/api` hosts the Express entrypoint, `src/worker` runs BullMQ jobs, and `src/shared` contains cross-cutting types. Frontend code resides in `apps/frontend` (Vite). Shared libraries belong in `packages/shared`, operational scripts in `scripts/`, and CLI helpers in `commands/`. Tests are grouped under `tests/**` (e.g., `tests/integration/projects.api.test.ts`), with Supabase configs and seed data in `supabase/`.

## Build, Test, and Development Commands
- `npm run dev` – starts API and worker with live reload; pair with `npm run fe:dev` for the UI.
- `npm run gates` – runs the typecheck, lint, unit, SAST, secrets, audit, and unused-code gates in parallel.
- `npm test` – executes the Vitest suite with coverage and enforces 0.90 changed-lines targets.
- `npm run test:unit` / `npm run test:integration` / `npm run test:e2e` – focused Jest or Playwright suites.
- `npm run lint` and `npm run typecheck` – quick hygiene checks before pushing.

## Coding Style & Naming Conventions
Code is TypeScript-first with 2-space indentation and mandatory semicolons. Follow the project ESLint rules; do not introduce alternative formatters. Use `camelCase` for variables/functions, `PascalCase` for classes and React components, and `UPPER_SNAKE_CASE` for environment variables. Prefer async/await and keep feature-specific utilities close to their owning module.

## Testing Guidelines
Use Vitest for fast unit feedback (`npm test`) and rely on Jest suites in `tests/*` for security, integration, and performance coverage. Name files with `*.test.ts` or `*.spec.ts` to stay visible to runners. Before opening a PR, run `npm run gates` plus any targeted suites touched by the change (e.g., `npm run test:e2e` for UI work). Maintain ≥90% coverage on modified lines and extend fixtures when mocking complex payloads.

## Commit & Pull Request Guidelines
Adopt Conventional Commits (`feat:`, `fix:`, `chore:`) and branch naming (`feat/*`, `fix/*`, `chore/*`). Keep commits focused, reference issue IDs when available, and summarize behavior changes in the PR description. Attach screenshots or terminal logs for notable UI/API updates. Verify gates locally, document any intentionally skipped tests, and convert drafts to review-ready only after docs and tests are updated.

## Security & Configuration Tips
Never commit credentials. When writing queries, rely on parameterized calls and log sensitive operations through `src/lib/logger.ts`, which already propagates request correlation IDs.

## MCP / Context7 Usage
Always use context7 when I need code generation, setup or configuration steps, or library/API documentation. This means you should automatically use the Context7 MCP tools to resolve library id and get library docs without me having to explicitly ask.

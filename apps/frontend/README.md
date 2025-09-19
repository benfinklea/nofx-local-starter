NOFX Frontend (Vite + React + TS)

Independent frontend for fast iteration. Served in production at `/ui/app` when built.

Dev
- Install: `cd apps/frontend && npm install`
- Start: `npm run dev` (or from repo root: `npm run fe:dev`)
- Open: http://localhost:5173
- API proxy: calls to `/runs`, `/models`, `/settings`, `/dev`, `/health`, `/metrics` are proxied to `http://localhost:3000`.

Build & Serve via API
- Build: `npm run fe:build` from repo root
- API will serve built assets at `/ui/app` automatically if `apps/frontend/dist` exists.
- Open: http://localhost:3000/ui/app

Shared Types (optional)
- This app can import from `packages/shared/src/types.ts`.
- Vite is configured to allow reads from `packages/shared`.
- Example: `import type { Plan } from '../../../packages/shared/src/types'`

iTerm2 / Terminal Workflow
- Pane 1: `npm run dev:api`
- Pane 2: `npm run dev:worker`
- Pane 3: `npm run fe:dev`
- Optional: `/ui/dev` page to start Observability (Prometheus/Grafana) when needed.

AI / Automation Tips
- FE is isolated under `apps/frontend`; changes won’t affect the plane.
- Use feature branches or a git worktree for larger UI spikes:
  - `git worktree add ../nofx-fe feat/frontend-v1`
  - Work in `../nofx-fe/apps/frontend`, then PR back.

Notes
- Node.js 20 LTS recommended.
- Keep React components small and typed; reuse shared types when possible.
- Use `/ui/app` as base for routing in production (configured via Vite `base`).


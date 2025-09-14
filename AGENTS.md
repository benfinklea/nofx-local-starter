# Agent Guidelines for NOFX Local Starter

Scope: Applies to the entire repository.

Core Principles
- Preserve existing functionality; never regress working features while changing code.
- Make minimal, targeted changes; avoid unrelated refactors.
- Prioritize reliability and robustness over cleverness; default to conservative approaches.
- Explain trade-offs when proposing options; prefer reversible steps.
- Use Node.js 20 LTS and existing npm scripts; do not add tooling without confirmation.

Planning & Workflow
- Use the plan tool for any task > 1 step; keep exactly one step in_progress.
- Share concise progress notes before long-running actions.
- Ask before destructive actions (rm/reset/history rewrite), DB schema changes, or network installs.
- Commits: Conventional Commits; branches: `feat/*`, `fix/*`, `chore/*`.

Technology & Stack Preferences
- Language: Prefer TypeScript over JavaScript.
- Testing:
  - Unit: Jest under `tests/**`.
  - Unit gate: Vitest changed-lines coverage via `scripts/runGate.js`.
  - E2E: Playwright for end-to-end when UI/flows are affected. Run Playwright locally/CI when available; if browsers or services are missing, document exact steps to run and do not block delivery.
- Linting/Style: Use the repo’s ESLint config. Only use Prettier if already configured.
- Package manager: npm; commit lockfile.

Quality Standards
- Test coverage: aim for 90%+ unit; enforce changed-lines coverage ≥ 0.90 in gate.
- Performance targets (guidance): API p95 < 200ms; DB query p95 < 100ms.
- Security: follow OWASP Top 10 practices; perform dependency audits; never store secrets in code.
- Accessibility (UI): prefer semantic HTML and ARIA; target WCAG 2.1 AA when adding UI.
- Documentation: add focused TSDoc/JSDoc for new/changed public APIs.

Development Process
- Code changes: incremental and tested over large rewrites.
- Error handling: comprehensive with structured logging; avoid leaking sensitive data.
- Observability: use structured logs (correlation IDs where relevant); keep/extend health checks.
- Security-first: parameterized queries; do not commit credentials; use env/secret stores.

Framework-Specific Guidance
- UI (EJS now; React if introduced later):
  - Use semantic HTML, ARIA labels, and error boundaries (React) as applicable.
  - Optimize for Core Web Vitals if/when using React.
  - Implement sensible state management if introducing React.
- Node.js/Backend:
  - Prefer async/await; implement middleware patterns in Express routes.
  - Use structured logging with request IDs; implement health checks and graceful shutdown.
  - Use DB connection pooling.
- Database:
  - Use parameterized queries; add indexes thoughtfully.
  - Apply schema changes via migrations; monitor query performance.

AI Behavior Preferences
- Explanations: briefly justify technical decisions and list trade-offs.
- Alternatives: suggest viable options when appropriate.
- Learning: add short educational context for new patterns when helpful.
- Uncertainty: call out uncertainty and propose verification steps.

Command & Repo Usage
- Prefer `rg` for search; read files in ≤ 250-line chunks.
- Scope commands to changed/related files; use `--all` only when necessary.
- Prefer incremental improvements over rewrites; validate changes with appropriate tests.

CI, Gates, and Coverage
- CI checks are split by gate: `gate-typecheck`, `gate-lint`, `gate-unit` (Vitest), and `jest-unit`.
- Codecov is enabled; keep PR comments minimal/off; rely on status checks.
- Maintain the changed-lines coverage gate at ≥ 0.90.

Monitoring & Security
- Structured logs with context; collect basic performance/error metrics where applicable.
- Input validation and output encoding for user content.
- Authentication/authorization checks where relevant; secure session/CSRF if adding forms.
- Secrets managed via environment/secret stores; support rotation.
- Audit logging for security-relevant events where applicable.

Documentation Standards
- Keep README accurate for setup and usage.
- Document API endpoints with examples when changed.
- Record significant design choices as lightweight ADRs when applicable.
- Add inline comments for complex business logic.
- Provide troubleshooting notes for common local issues.

Compliance & Safety (as applicable)
- Avoid leaking sensitive information in errors/logs.
- Prefer HTTPS and rate limiting in deploy contexts.
- Maintain audit trails for compliance-sensitive changes.

Local Running
- Supabase Local for DB/Auth/Storage; Redis for queue.
- Use provided npm scripts (e.g., `dev`, `gates`).

Non-Negotiable
- Always preserve existing functionality and fix the specific issue without breaking features.

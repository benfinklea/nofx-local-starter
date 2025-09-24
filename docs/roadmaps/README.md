# NOFX Roadmap Operator Playbook

You can run this entire roadmap solo. Treat each phase as a focused iteration; finish it end-to-end before starting the next. The table below lists the phases in order.

## How to Work Solo
1. Use a three-window setup (editor, docs, terminal) or tmux panes.
2. Open the relevant phase doc and work through the tracks top-to-bottom.
3. After each track, run the phase-specific tests plus the baseline commands below.
4. Log notable changes in CHANGELOG.md or your task tracker.

## Baseline Commands (run after every track)
- npm run lint
- npm run typecheck
- npm run test -- --runInBand
- npm run gates (after sandbox or heavy runtime changes)

## Phase Overview
| Phase | Focus |
| --- | --- |
| 1 | Agent/template registries |
| 2 | Safety infrastructure (event bus, hooks, sandboxes) |
| 3 | Backlog ingestion + pack sync |
| 4 | Auto planner & human gating |
| 5 | Observability, checkpoints, LLM review gate |
| 6 | Hierarchical/hive orchestration & remediation |
| 7 | Governance, compliance, NL ops |

Zig Todo mirrors the same phases; advance it once the matching NOFX phase is green.

## Testing Strategy
- Unit tests for new helpers (event bus, parsers, planners, etc.).
- Integration suites under tests/ for ingestion, planner, sandbox drivers, review gates.
- Smoke tests via npm run gates before leaving a phase and whenever execution drivers change.
- Manual validation using the new UI/CLI features introduced in that phase.

Document issues or flaky tests immediately—fixing them while context is fresh saves time later.

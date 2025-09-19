# Agent Builder Initiative

_Updated: 2024-??-??_

## Mission
Create a delightful tool for defining, iterating on, and deploying AI agents across surfaces (web app, Slack, mobile, wearables) so busy operator roles can ask "What should I work on right now?" and receive actionable focus plans.

## Scope For This Branch
- Keep existing NOFX control-plane runtime as auditable execution backbone.
- Introduce agent-centric concepts: definitions, capabilities, triggers, deployment targets, and alert policies.
- Deliver the first flagship experience: **Daily Focus Coach** tailored to multi-client marketing leaders.

## Current Status
- `main` now tracks the merged guardrails + multi-app workspace baseline (commit `f2f3ff7`).
- New branch `feat/agent-builder` holds documentation updates for the agent-focused pivot.
- Legacy docs (`docs/business-os-strategy`, `docs/workstreams/...UNBREAKABILITY`) removed to reduce noise.

## Research Constraints
- Network access is currently disabled, so external verification of OpenAI's Responses API is pending.
- Action item: once network access is enabled, review <https://platform.openai.com/docs/api-reference/responses> and recent SDK examples (OpenAI Node 4.x, Python 1.x) to confirm streaming patterns, tool hand-offs, and multi-turn agent loops.

## Conversation Log (Highlights)
- **Vision**: Single console to create, update, and deploy agents with zero-friction; agents usable inside the app or exported to Slack/other channels.
- **Pain Point**: CMO managing multiple teams/clients needs a contextual AI that tracks goals, meetings, energy levels, and suggests the next best task or delegation.
- **Data Inputs**: client interviews, goals, meeting transcripts, websites, research docs, brainstorming ideas (vetted/unvetted), calendars, emails, surveys, 3rd-party reports.
- **Experience Goals**:
  - Voice + quick capture on iPhone/Apple Watch (“Add task”, “What’s next?”, “Prep for upcoming meeting”).
  - Desktop/web UI for deep planning, collaboration, and agent programming.
  - Energy-aware recommendations (tie in Apple Watch signals: heart rate, temperature, blood pressure) suggesting tasks or breaks.
  - Alerts must be reliable; system cannot miss urgent items.
  - Provide AI-executability score (0-100) to show how much an agent can automate.
- **Agent Architecture Thoughts**:
  - Keep run/event log for auditing and human-in-the-loop checkpoints.
  - Support deployment targets (in-app, Slack, email/SMS) from a single definition.
  - Library of prebuilt marketing/operator agent templates.
  - Integrate with tool APIs (OpenAI Responses, Anthropic, local models) via pluggable action layer.

## Planned Documents
- `docs/agent-builder/PLAN.md` – phased roadmap (to be written next).
- `docs/agent-builder/DAILY_FOCUS_COACH.md` – product brief for first agent.
- `docs/agent-builder/INTEGRATIONS.md` – catalog of required external systems (calendar, CRM, storage, alerts).
- `docs/agent-builder/RESEARCH_NOTES.md` – findings once Responses API documentation is reviewed with network access.

## Next Actions
1. Draft the high-level plan document capturing phases, deliverables, and validation steps.
2. Outline data model changes needed for agent definitions versus individual runs.
3. Schedule follow-up session with network access to confirm Responses API usage patterns and update docs accordingly.


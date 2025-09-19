# Conversation Summary — Pivot to Agent Builder

## Participants
- Ben (CMO/operator, product owner)
- Codex assistant (this session)

## Timeline Highlights
1. **Project Direction Reset**
   - Desire to move away from heavy control-plane hardening toward a product people enjoy using.
   - Interest in a tool that simplifies creating and deploying agents (similar to OpenAI Assistants, but tailored).

2. **User Problem Framing**
   - CMO juggling multiple companies, clients, campaigns; overwhelmed by prioritization.
   - Needs conversational interface to load client context, track goals, and ask “what now?”
   - Wants team-wide usage so everyone feeds context and sees progress/risks.

3. **Context Sources Identified**
   - Client interviews, goals (long-term, quarterly, annual).
   - Meeting recordings/transcripts, websites, public accolades, surveys, consultant research.
   - Internal brainstorming ideas (both unvetted and client-approved), emails, calendars.

4. **Desired Interactions**
   - **Capture on the go**: iPhone widget, Apple Watch voice input to add tasks or ask for guidance.
   - **Desktop deep work**: dashboard showing priorities, blockers, delegation opportunities.
   - **Energy-aware suggestions**: declare low/high energy or auto-detect via Apple Watch vitals; system adjusts tasks or recommends breaks/learning.
   - **Learning nudges**: agent recommends soft-skill or tooling improvements when time allows.

5. **Execution Assist**
   - Integrate with agentic toolchains (OpenAI Responses API, other LLM providers) to offload work.
   - Provide AI-executability likelihood score (0-100) per task, encouraging automation mindset.

6. **Alerting Requirements**
   - Mission-critical alerts for urgent tasks/meetings must be reliable; trust hinges on notification accuracy.

7. **Technical Direction**
   - Keep NOFX backend (runs, steps, worker, queue) as auditable backbone.
   - Layer agent definitions, templates, and deployment surfaces (in-app, Slack, etc.).
   - Voice-first future is attractive but immediate focus on dependable prioritization loop.

8. **Research Gaps**
   - Need to study OpenAI Responses API (Assistants deprecated) once network access is enabled.
   - Explore health data access, alert channels, and integration patterns.

## Next Steps (Per Conversation)
- Document plan (done in `PLAN.md`).
- Wait for session with network access to complete Responses API research and update docs.
- Begin designing Daily Focus Coach agent on top of existing infrastructure.


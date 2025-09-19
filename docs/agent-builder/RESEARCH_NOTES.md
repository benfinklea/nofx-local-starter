# Research Notes — OpenAI Responses API

_Last pulled via Context7 on 2025-09-18._

## Quick Command to Refresh Docs
Before running, export `CONTEXT7_API_KEY` with your personal token (keep it outside version control).
```bash
# 1) Find the latest library id for the Responses docs
curl -s \
  -H "Authorization: Bearer ${CONTEXT7_API_KEY}" \
  -H "mcp-client-ip: 127.0.0.1" \
  "https://context7.com/api/v1/search?query=OpenAI%20Responses" | jq '.results[0].id'

# 2) Pull Responses-specific documentation (adjust topic/tokens as needed)
curl -s \
  -H "Authorization: Bearer ${CONTEXT7_API_KEY}" \
  -H "mcp-client-ip: 127.0.0.1" \
  "https://context7.com/api/v1/websites/platform_openai?type=txt&topic=Responses%20API&tokens=5000"
```

_Context7 requires the bearer key plus an `mcp-client-ip` header (any loopback IP is fine). The second command streams the same text used below; redirect to a file for offline review._

## Capability Overview
- **Primary endpoint**: `POST /v1/responses` handles unified LLM calls with structured `input` items (text, image, file), optional `instructions`, `metadata`, `tool_choice`, `parallel_tool_calls`, `reasoning`, `max_output_tokens`, and `service_tier` selection.
- **Follow-up ops**: `GET /v1/responses/{id}`, `DELETE /v1/responses/{id}`, `POST /v1/responses/{id}/cancel` (background runs only), `GET /v1/responses/{id}/input_items` for replay.
- **Conversations**: either rely on OpenAI-managed `conversation` IDs (`/v1/conversations/*`) or run stateless with `store:false`/`previous_response_id` and persist history ourselves.

## Streaming & Events
- `stream:true` returns SSE batches: creation/in-progress/completed, `response.output_text.delta|done`, tool deltas (`response.function_call_arguments.*`, `response.mcp_call.*`, `response.file_search_call.*`, etc.), audio chunks (`response.output_audio.delta|done`), reasoning summaries, refusals, plus generic `error`.
- Resume streams with `starting_after` using `sequence_number`. Every event includes consistent ordering guarantees.

## Tooling Model
- Requests declare `tools` (custom functions, built-ins like web search/file search/code interpreter/computer use, or MCP connectors) and optional `tool_choice`. `max_tool_calls` caps total invocations. Built-ins expose additional include flags (e.g., `file_search_call.results`).
- Tool results appear as `tool_result` content items; parallel execution supported when `parallel_tool_calls:true`.

## Operations & Governance
- Responses return rich usage telemetry (`input_tokens`, `output_tokens`, cached/reasoning/audio splits) and service metadata (`service_tier`, `prompt_cache_key`).
- Inspect headers for throttling/latency: `x-ratelimit-limit|remaining|reset-(requests|tokens)`, `openai-processing-ms`, and `x-request-id` (log for support escalations).
- `metadata` accepts up to 16 string pairs; `safety_identifier` lets us hash user identity for abuse monitoring.

## Background Runs & Webhooks
- `background:true` pushes work to async runner. Poll via retrieve or handle project webhooks: `response.completed`, `response.cancelled`, `response.failed`, `response.incomplete`.
- Additional webhooks exist for batch jobs, eval runs, fine-tuning, and realtime SIP events—mirror gating logic before enabling.

## Adjacent Surfaces Noted in Docs
- Audio (`/v1/audio/speech`, `/v1/audio/transcriptions`, `/v1/audio/translations`) for TTS/STT combos.
- Images (`/v1/images/generations|edits|variations`).
- Embeddings, Moderations, Evals, Vector Stores, Files/Uploads, Realtime (WebRTC/WebSocket), and legacy Chat/Completions remain available with similar semantics.

## Implementation Reminders
- Pre-validate context size when `truncation:"disabled"` to avoid 400s.
- Persist streaming state machine transitions so UI can resume deltas cleanly; treat `response.failed`/`response.incomplete` as actionable states.
- Capture `usage`, `metadata`, request IDs, and rate-limit snapshots per run for analytics + throttling.
- When using built-ins, remember `include` flags (e.g., `file_search_call.results`, `message.output_text.logprobs`, `reasoning.encrypted_content`).

## Outstanding Questions / Follow-ups
- Determine optimal blend of replaying history vs. storing short-term memory to balance token cost and fidelity.
- Decide retention policy for raw SSE deltas vs. summarized outputs for auditing.
- Feature-flag stateless vs. conversation-backed flow per tenant to simplify migrations.


Workstream 06 — Performance & Cost

Objective
Keep latency low and costs predictable.

Steps
1) DAG parallelism
   - Run independent steps concurrently with a bounded worker pool.
2) Concurrency & backpressure
   - Limit per-worker concurrency; push back on enqueue when queue age grows.
3) Token budgets & max output
   - Enforce per-step token budgets; route to cheaper models for docs by default.
4) Caching
   - Hash(prompt, model) → cache responses for docs; TTL and invalidation hooks.

Measurements
- Track P50/P95 step latency and queue age.
- Report cost per run in the header (already shown) and per step in events.


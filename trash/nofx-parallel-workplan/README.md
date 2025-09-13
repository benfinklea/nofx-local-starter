# NOFX Parallel Workplan

Run **00_BASE** first (single agent). After it merges, you can run **10, 20, 30, 40, 50, 60** **in parallel** — no file collisions by design.
When all are merged, run the post-merge commands at the end.

## Task graph
```
00_BASE  --->  [10_GATES, 20_UI, 30_APPROVALS, 40_MODEL_ROUTER, 50_QUEUE_SQS, 60_DB_WRITE]
```

Each task lives in `tasks/<ID>_*.md` with exact file paths and code blocks.

Workstream 05 — Backup & Restore

Objective
Never lose work; easy point‑in‑time recovery.

How to run (terminal A — API/UI)
- `npm start` (Simple Mode) or `npm run dev` (API+Worker)

How to run (terminal B — backup triggers)
- Manual backup via API:
  - `curl -X POST http://localhost:3000/backups -H 'Content-Type: application/json' -d '{"note":"checkpoint"}'`
- List backups:
  - `curl http://localhost:3000/backups`
- Restore a backup:
  - `curl -X POST http://localhost:3000/backups/<id>/restore`

Autobackup
- Set `BACKUP_INTERVAL_MIN=30` in `.env` and restart. Snapshots will be taken every 30 minutes and uploaded to Supabase Storage if configured.

Notes
- Simple Mode restores overwrite `local_data/` (a safety snapshot is created automatically first).


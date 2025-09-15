Title: NOFX Backup & Restore Plan (Local + Cloud)

Overview
- Continuous, local-first snapshots of all agent state, with optional cloud copy.
- Zero-knowledge restore UX: choose a timestamped point-in-time; we auto-snapshot before restoring.

What is backed up
- Simple Mode (filesystem store): entire `local_data/` directory, including runs, steps, events, artifacts, and settings. Stored as `local_data/backups/<id>.tar.gz` with a sidecar `<id>.json` metadata file.
- DB Mode (Postgres store): JSON exports of core tables (`nofx.run`, `nofx.step`, `nofx.event`, `nofx.gate`, `nofx.artifact`, `nofx.settings`, `nofx.model`). Tarred to the same location.
- Optional cloud copy: if Supabase Storage is configured, a copy of the tarball is uploaded to `artifacts/backups/`.

How backups are named
- `<ISO timestamp>-<slug of latest run goal>`; e.g., `2025-09-14T19-55-28-123Z-write-a-readme.tar.gz`
- Users can add a note in the Settings → Backups panel (optional).

How to use (UI)
- Go to Settings → Backups.
- Click “Backup Now” (add an optional note).
- Restore: click Restore on any row. We auto-snapshot the current state first, then restore.

How to use (API)
- List: `GET /backups` (admin only)
- Create: `POST /backups` with JSON `{ "note": "optional" }`
- Restore: `POST /backups/:id/restore`

Continuous backups
- Set `BACKUP_INTERVAL_MIN=30` in `.env` to snapshot every 30 minutes. Copies are uploaded to cloud if configured.

Restore semantics
- Simple Mode: extract the tarball onto `local_data/` (overwrites files). Safety snapshot is taken automatically before restore.
- DB Mode: metadata export is available; full automated DB import is planned. Today, restoring will protect current state (safety snapshot) and make snapshot artifacts/metadata available. For production deployments, use managed Postgres backups in addition to NOFX snapshots.

Notes
- Backups are content-addressable by filename and metadata; keep your `local_data/backups/` folder under Time Machine or similar for extra safety.
- For cloud redundancy without Supabase Storage, configure any S3-compatible storage via a gateway or add a sync step post-snapshot (rclone/rsync).


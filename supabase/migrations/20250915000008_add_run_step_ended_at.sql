-- Add ended_at columns for run and step tables to match application expectations
ALTER TABLE nofx.run
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE nofx.step
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- Backfill ended_at with completed_at when available so historic data stays consistent
UPDATE nofx.run
SET ended_at = COALESCE(ended_at, completed_at),
    metadata = COALESCE(metadata, '{}'::jsonb)
WHERE completed_at IS NOT NULL;

UPDATE nofx.step
SET ended_at = COALESCE(ended_at, completed_at)
WHERE completed_at IS NOT NULL;

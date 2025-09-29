-- API Idempotency Cache Table
-- Enables RFC-compliant idempotency for REST API endpoints

-- Create idempotency cache table for API-level request deduplication
CREATE TABLE IF NOT EXISTS nofx.idempotency_cache (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'local',
  key text not null,
  method text not null,
  path text not null,
  status_code integer not null,
  response_headers jsonb,
  response_body jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  UNIQUE(tenant_id, key, method, path)
);

-- Index for efficient cleanup of expired entries
CREATE INDEX IF NOT EXISTS idempotency_cache_expires_idx
  ON nofx.idempotency_cache(expires_at);

-- Index for fast lookups during request processing
CREATE INDEX IF NOT EXISTS idempotency_cache_lookup_idx
  ON nofx.idempotency_cache(tenant_id, key, method, path);

-- Optional: Create a function to automatically clean up expired entries
CREATE OR REPLACE FUNCTION nofx.cleanup_expired_idempotency_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM nofx.idempotency_cache WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
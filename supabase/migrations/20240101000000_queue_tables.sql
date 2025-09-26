-- Queue Tables for PostgreSQL-based Queue System
-- This eliminates the need for Redis/Upstash

-- Create queue_jobs table
CREATE TABLE IF NOT EXISTS queue_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dlq')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  error TEXT,
  worker_id VARCHAR(255),

  -- Indexes for performance
  INDEX idx_queue_jobs_topic_status (topic, status),
  INDEX idx_queue_jobs_locked_until (locked_until),
  INDEX idx_queue_jobs_created_at (created_at)
);

-- Function to claim the next available job atomically
CREATE OR REPLACE FUNCTION claim_next_job(
  p_topic VARCHAR,
  p_worker_id VARCHAR,
  p_lock_duration_seconds INTEGER DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  payload JSONB,
  attempts INTEGER,
  max_attempts INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE queue_jobs
  SET
    status = 'processing',
    worker_id = p_worker_id,
    locked_until = NOW() + INTERVAL '1 second' * p_lock_duration_seconds,
    updated_at = NOW()
  WHERE id = (
    SELECT id
    FROM queue_jobs
    WHERE
      topic = p_topic
      AND status = 'pending'
      AND (locked_until IS NULL OR locked_until < NOW())
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING
    queue_jobs.id,
    queue_jobs.payload,
    queue_jobs.attempts,
    queue_jobs.max_attempts;
END;
$$;

-- Function to reprocess stuck jobs
CREATE OR REPLACE FUNCTION recover_stuck_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  count INTEGER;
BEGIN
  UPDATE queue_jobs
  SET
    status = 'pending',
    worker_id = NULL,
    locked_until = NULL,
    updated_at = NOW()
  WHERE
    status = 'processing'
    AND locked_until < NOW() - INTERVAL '5 minutes';

  GET DIAGNOSTICS count = ROW_COUNT;
  RETURN count;
END;
$$;

-- Periodic cleanup of old completed jobs
CREATE OR REPLACE FUNCTION cleanup_old_jobs(days_to_keep INTEGER DEFAULT 7)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  count INTEGER;
BEGIN
  DELETE FROM queue_jobs
  WHERE
    status = 'completed'
    AND created_at < NOW() - INTERVAL '1 day' * days_to_keep;

  GET DIAGNOSTICS count = ROW_COUNT;
  RETURN count;
END;
$$;

-- Create RPC wrapper for table creation (for adapter initialization)
CREATE OR REPLACE FUNCTION create_queue_tables_if_not_exists()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Table creation is handled by migration, this is just a no-op
  -- that the adapter can safely call
  RETURN;
END;
$$;

-- Metrics view for monitoring
CREATE OR REPLACE VIEW queue_metrics AS
SELECT
  topic,
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest_job,
  MAX(created_at) as newest_job,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_processing_time_seconds
FROM queue_jobs
GROUP BY topic, status;

-- Enable Row Level Security
ALTER TABLE queue_jobs ENABLE ROW LEVEL SECURITY;

-- Policy for service role (full access)
CREATE POLICY "Service role has full access to queue_jobs" ON queue_jobs
  FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language plpgsql;

CREATE TRIGGER update_queue_jobs_updated_at
  BEFORE UPDATE ON queue_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
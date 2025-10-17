-- Create usage_warnings table to track when warning emails are sent
-- This prevents sending duplicate warnings in the same billing period

CREATE TABLE IF NOT EXISTS usage_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric TEXT NOT NULL CHECK (metric IN ('runs', 'api_calls')),
  threshold INTEGER NOT NULL CHECK (threshold IN (80, 90, 100)),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure we don't insert duplicate warnings
  UNIQUE(user_id, metric, threshold, DATE_TRUNC('month', sent_at))
);

-- Create index for faster lookups
CREATE INDEX idx_usage_warnings_user_metric ON usage_warnings(user_id, metric, sent_at DESC);

-- Create index for cleanup queries
CREATE INDEX idx_usage_warnings_sent_at ON usage_warnings(sent_at);

-- Add RLS policies
ALTER TABLE usage_warnings ENABLE ROW LEVEL SECURITY;

-- Users can view their own warnings
CREATE POLICY "Users can view own usage warnings"
  ON usage_warnings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert/update/delete
CREATE POLICY "Service role can manage usage warnings"
  ON usage_warnings
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create function to cleanup old warnings (older than 6 months)
CREATE OR REPLACE FUNCTION cleanup_old_usage_warnings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM usage_warnings
  WHERE sent_at < NOW() - INTERVAL '6 months';
END;
$$;

-- Add comment for documentation
COMMENT ON TABLE usage_warnings IS 'Tracks when usage warning emails are sent to prevent duplicates in the same billing period';
COMMENT ON COLUMN usage_warnings.threshold IS 'Warning threshold percentage: 80 (info), 90 (warning), 100 (critical)';

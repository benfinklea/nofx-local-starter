-- Migration: Add Agent SDK Support
-- Date: September 29, 2025
-- Description: Add session tracking and SDK metadata to support Claude Agent SDK integration

-- Add session tracking columns to run table
ALTER TABLE nofx.run
  ADD COLUMN IF NOT EXISTS sdk_session_id TEXT,
  ADD COLUMN IF NOT EXISTS sdk_metadata JSONB DEFAULT '{}'::jsonb;

-- Add index for session lookups
CREATE INDEX IF NOT EXISTS idx_run_sdk_session ON nofx.run(sdk_session_id);

-- Add comment to document SDK-specific event types
COMMENT ON COLUMN nofx.event.type IS
  'Event type: run.*, step.*, gate.*, manual.*, sdk.message, sdk.tool_call, sdk.tool_result, cost.alert';

-- Add comment to document SDK outputs in steps
COMMENT ON COLUMN nofx.step.outputs IS
  'Step outputs including tokensUsed, cost, model, sessionId for SDK-powered steps';

-- Create view for SDK usage analytics
CREATE OR REPLACE VIEW nofx.sdk_usage_stats AS
SELECT
  DATE_TRUNC('day', r.created_at) as date,
  COUNT(DISTINCT r.id) as total_runs,
  COUNT(DISTINCT r.sdk_session_id) FILTER (WHERE r.sdk_session_id IS NOT NULL) as sdk_runs,
  COUNT(DISTINCT r.id) FILTER (WHERE r.sdk_session_id IS NULL) as legacy_runs,
  SUM((s.outputs->>'tokensUsed')::int) FILTER (WHERE s.outputs->>'generatedBy' = 'agent-sdk') as sdk_tokens,
  SUM((s.outputs->>'cost')::numeric) FILTER (WHERE s.outputs->>'generatedBy' = 'agent-sdk') as sdk_cost,
  AVG((s.outputs->>'tokensUsed')::int) FILTER (WHERE s.outputs->>'generatedBy' = 'agent-sdk') as avg_tokens_per_sdk_step,
  AVG((s.outputs->>'cost')::numeric) FILTER (WHERE s.outputs->>'generatedBy' = 'agent-sdk') as avg_cost_per_sdk_step
FROM nofx.run r
LEFT JOIN nofx.step s ON s.run_id = r.id
GROUP BY DATE_TRUNC('day', r.created_at)
ORDER BY date DESC;

-- Grant select on the view
GRANT SELECT ON nofx.sdk_usage_stats TO authenticated;
GRANT SELECT ON nofx.sdk_usage_stats TO anon;

-- Create view for cost monitoring
CREATE OR REPLACE VIEW nofx.sdk_cost_summary AS
SELECT
  r.id as run_id,
  r.created_at,
  r.sdk_session_id,
  r.status,
  COUNT(s.id) as total_steps,
  COUNT(s.id) FILTER (WHERE s.outputs->>'generatedBy' = 'agent-sdk') as sdk_steps,
  SUM((s.outputs->>'tokensUsed')::int) FILTER (WHERE s.outputs->>'generatedBy' = 'agent-sdk') as total_tokens,
  SUM((s.outputs->>'cost')::numeric) FILTER (WHERE s.outputs->>'generatedBy' = 'agent-sdk') as total_cost,
  MAX((s.outputs->>'cost')::numeric) as max_step_cost,
  ARRAY_AGG(
    CASE
      WHEN s.outputs->>'generatedBy' = 'agent-sdk'
      THEN jsonb_build_object(
        'step_id', s.id,
        'step_name', s.name,
        'cost', s.outputs->>'cost',
        'tokens', s.outputs->>'tokensUsed',
        'model', s.outputs->>'model'
      )
      ELSE NULL
    END
  ) FILTER (WHERE s.outputs->>'generatedBy' = 'agent-sdk') as sdk_step_details
FROM nofx.run r
LEFT JOIN nofx.step s ON s.run_id = r.id
WHERE r.sdk_session_id IS NOT NULL
GROUP BY r.id, r.created_at, r.sdk_session_id, r.status
ORDER BY r.created_at DESC;

-- Grant select on cost summary view
GRANT SELECT ON nofx.sdk_cost_summary TO authenticated;
GRANT SELECT ON nofx.sdk_cost_summary TO anon;

-- Add helpful comments
COMMENT ON VIEW nofx.sdk_usage_stats IS
  'Daily statistics comparing Agent SDK usage vs legacy model router';

COMMENT ON VIEW nofx.sdk_cost_summary IS
  'Per-run cost breakdown for Agent SDK executions with detailed step costs';

COMMENT ON COLUMN nofx.run.sdk_session_id IS
  'Claude Agent SDK session ID - enables session persistence and memory across steps';

COMMENT ON COLUMN nofx.run.sdk_metadata IS
  'Agent SDK metadata including session info, total costs, and configuration';
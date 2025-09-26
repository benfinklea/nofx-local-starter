-- Combined migration script for Supabase
-- Run this in the Supabase SQL editor to set up all tables

-- 1. Create nofx schema
CREATE SCHEMA IF NOT EXISTS nofx;

-- 2. Run table
CREATE TABLE IF NOT EXISTS nofx.run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'local',
  plan JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  project_id TEXT,
  metadata JSONB,
  ended_at TIMESTAMPTZ
);

-- 3. Step table
CREATE TABLE IF NOT EXISTS nofx.step (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'local',
  run_id UUID NOT NULL REFERENCES nofx.run(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tool TEXT NOT NULL,
  inputs JSONB,
  outputs JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  idempotency_key TEXT,
  ended_at TIMESTAMPTZ
);

-- 4. Artifact table
CREATE TABLE IF NOT EXISTS nofx.artifact (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'local',
  step_id UUID NOT NULL REFERENCES nofx.step(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  path TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Event table
CREATE TABLE IF NOT EXISTS nofx.event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'local',
  run_id UUID NOT NULL REFERENCES nofx.run(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  step_id UUID
);

-- 6. Gates table
CREATE TABLE IF NOT EXISTS nofx.gate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES nofx.run(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES nofx.step(id) ON DELETE CASCADE,
  gate_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ
);

-- 7. Settings table
CREATE TABLE IF NOT EXISTS nofx.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  llm_provider TEXT,
  llm_model TEXT,
  llm_api_key TEXT,
  quality_mode TEXT DEFAULT 'quality',
  open_pr_on_complete BOOLEAN DEFAULT false,
  project_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Models table
CREATE TABLE IF NOT EXISTS nofx.models (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  capabilities TEXT[] NOT NULL DEFAULT '{}',
  max_tokens INTEGER,
  context_window INTEGER,
  input_price_per_1k DECIMAL(10, 6),
  output_price_per_1k DECIMAL(10, 6),
  is_active BOOLEAN DEFAULT true,
  is_recommended BOOLEAN DEFAULT false,
  tier TEXT DEFAULT 'standard',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Queue tables
CREATE TABLE IF NOT EXISTS nofx.queue_jobs (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  priority INTEGER DEFAULT 0,
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nofx.queue_history (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_run_tenant_id ON nofx.run(tenant_id);
CREATE INDEX IF NOT EXISTS idx_run_status ON nofx.run(status);
CREATE INDEX IF NOT EXISTS idx_step_run_id ON nofx.step(run_id);
CREATE INDEX IF NOT EXISTS idx_step_status ON nofx.step(status);
CREATE INDEX IF NOT EXISTS idx_artifact_step_id ON nofx.artifact(step_id);
CREATE INDEX IF NOT EXISTS idx_event_run_id ON nofx.event(run_id);
CREATE INDEX IF NOT EXISTS idx_event_type ON nofx.event(type);
CREATE INDEX IF NOT EXISTS idx_gate_run_id ON nofx.gate(run_id);
CREATE INDEX IF NOT EXISTS idx_gate_step_id ON nofx.gate(step_id);
CREATE INDEX IF NOT EXISTS idx_gate_status ON nofx.gate(status);
CREATE INDEX IF NOT EXISTS idx_settings_project_id ON nofx.settings(project_id);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_topic ON nofx.queue_jobs(topic);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_status ON nofx.queue_jobs(status);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_scheduled_at ON nofx.queue_jobs(scheduled_at);

-- 11. Updated_at trigger function
CREATE OR REPLACE FUNCTION nofx.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. Apply updated_at triggers
DROP TRIGGER IF EXISTS update_run_updated_at ON nofx.run;
CREATE TRIGGER update_run_updated_at BEFORE UPDATE ON nofx.run
  FOR EACH ROW EXECUTE FUNCTION nofx.update_updated_at_column();

DROP TRIGGER IF EXISTS update_step_updated_at ON nofx.step;
CREATE TRIGGER update_step_updated_at BEFORE UPDATE ON nofx.step
  FOR EACH ROW EXECUTE FUNCTION nofx.update_updated_at_column();

DROP TRIGGER IF EXISTS update_settings_updated_at ON nofx.settings;
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON nofx.settings
  FOR EACH ROW EXECUTE FUNCTION nofx.update_updated_at_column();

DROP TRIGGER IF EXISTS update_models_updated_at ON nofx.models;
CREATE TRIGGER update_models_updated_at BEFORE UPDATE ON nofx.models
  FOR EACH ROW EXECUTE FUNCTION nofx.update_updated_at_column();

DROP TRIGGER IF EXISTS update_queue_jobs_updated_at ON nofx.queue_jobs;
CREATE TRIGGER update_queue_jobs_updated_at BEFORE UPDATE ON nofx.queue_jobs
  FOR EACH ROW EXECUTE FUNCTION nofx.update_updated_at_column();

-- 13. Enable Row Level Security (RLS)
ALTER TABLE nofx.run ENABLE ROW LEVEL SECURITY;
ALTER TABLE nofx.step ENABLE ROW LEVEL SECURITY;
ALTER TABLE nofx.artifact ENABLE ROW LEVEL SECURITY;
ALTER TABLE nofx.event ENABLE ROW LEVEL SECURITY;
ALTER TABLE nofx.gate ENABLE ROW LEVEL SECURITY;
ALTER TABLE nofx.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE nofx.models ENABLE ROW LEVEL SECURITY;
ALTER TABLE nofx.queue_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nofx.queue_history ENABLE ROW LEVEL SECURITY;

-- 14. Create policies for anon access (for development)
-- In production, you'd want more restrictive policies
CREATE POLICY "Enable all for anon" ON nofx.run FOR ALL TO anon USING (true);
CREATE POLICY "Enable all for anon" ON nofx.step FOR ALL TO anon USING (true);
CREATE POLICY "Enable all for anon" ON nofx.artifact FOR ALL TO anon USING (true);
CREATE POLICY "Enable all for anon" ON nofx.event FOR ALL TO anon USING (true);
CREATE POLICY "Enable all for anon" ON nofx.gate FOR ALL TO anon USING (true);
CREATE POLICY "Enable all for anon" ON nofx.settings FOR ALL TO anon USING (true);
CREATE POLICY "Enable all for anon" ON nofx.models FOR ALL TO anon USING (true);
CREATE POLICY "Enable all for anon" ON nofx.queue_jobs FOR ALL TO anon USING (true);
CREATE POLICY "Enable all for anon" ON nofx.queue_history FOR ALL TO anon USING (true);

-- Create a view in public schema for easier access
CREATE OR REPLACE VIEW public.runs AS SELECT * FROM nofx.run;
CREATE OR REPLACE VIEW public.steps AS SELECT * FROM nofx.step;
CREATE OR REPLACE VIEW public.events AS SELECT * FROM nofx.event;
CREATE OR REPLACE VIEW public.gates AS SELECT * FROM nofx.gate;
CREATE OR REPLACE VIEW public.artifacts AS SELECT * FROM nofx.artifact;
CREATE OR REPLACE VIEW public.settings AS SELECT * FROM nofx.settings;
CREATE OR REPLACE VIEW public.models AS SELECT * FROM nofx.models;

GRANT ALL ON SCHEMA nofx TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA nofx TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA nofx TO anon;

-- Success message
SELECT 'All NOFX tables created successfully!' as message;
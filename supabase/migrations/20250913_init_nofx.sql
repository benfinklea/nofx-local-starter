-- Create nofx schema
CREATE SCHEMA IF NOT EXISTS nofx;

-- Run table
CREATE TABLE nofx.run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'local',
  plan JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Step table
CREATE TABLE nofx.step (
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
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Artifact table
CREATE TABLE nofx.artifact (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'local',
  step_id UUID NOT NULL REFERENCES nofx.step(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  path TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Event table
CREATE TABLE nofx.event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'local',
  run_id UUID NOT NULL REFERENCES nofx.run(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_run_tenant_id ON nofx.run(tenant_id);
CREATE INDEX idx_run_status ON nofx.run(status);
CREATE INDEX idx_step_run_id ON nofx.step(run_id);
CREATE INDEX idx_step_status ON nofx.step(status);
CREATE INDEX idx_artifact_step_id ON nofx.artifact(step_id);
CREATE INDEX idx_event_run_id ON nofx.event(run_id);
CREATE INDEX idx_event_type ON nofx.event(type);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION nofx.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_run_updated_at BEFORE UPDATE ON nofx.run
  FOR EACH ROW EXECUTE FUNCTION nofx.update_updated_at_column();

CREATE TRIGGER update_step_updated_at BEFORE UPDATE ON nofx.step
  FOR EACH ROW EXECUTE FUNCTION nofx.update_updated_at_column();
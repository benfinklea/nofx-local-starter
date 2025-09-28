-- Phase 2: Advanced Orchestration & Intelligence Schema
-- This migration adds multi-agent orchestration, intelligent workflows, and predictive analytics

set search_path = public;

-- ============================================
-- TRACK A: MULTI-AGENT ORCHESTRATION ENGINE
-- ============================================

-- Agent orchestration sessions
create table if not exists nofx.agent_sessions (
  id uuid primary key default gen_random_uuid(),
  orchestration_type text not null check (orchestration_type in ('solo', 'pair', 'hierarchical', 'swarm')),
  primary_agent_id uuid references nofx.agent_registry(id),
  session_metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'completed', 'failed', 'cancelled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  performance_metrics jsonb,
  created_at timestamptz not null default now()
);

-- Agent relationships for hierarchical orchestration
create table if not exists nofx.agent_relationships (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references nofx.agent_sessions(id) on delete cascade,
  supervisor_agent_id uuid not null references nofx.agent_registry(id),
  worker_agent_id uuid not null references nofx.agent_registry(id),
  relationship_type text not null check (relationship_type in ('supervisor', 'peer', 'subordinate')),
  created_at timestamptz not null default now(),
  unique(session_id, supervisor_agent_id, worker_agent_id)
);

-- Inter-agent communication messages
create table if not exists nofx.agent_communications (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references nofx.agent_sessions(id) on delete cascade,
  from_agent_id uuid not null references nofx.agent_registry(id),
  to_agent_id uuid references nofx.agent_registry(id), -- NULL for broadcast
  message_type text not null,
  payload jsonb not null,
  acknowledged_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Agent capability profiles for smart routing
create table if not exists nofx.agent_capabilities (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references nofx.agent_registry(id) on delete cascade,
  skill_id text not null,
  proficiency_level integer not null check (proficiency_level between 1 and 10),
  resource_requirements jsonb not null default '{}'::jsonb,
  average_latency_ms integer,
  success_rate decimal(5,4) check (success_rate between 0 and 1),
  cost_per_operation decimal(10,4),
  updated_at timestamptz not null default now(),
  unique(agent_id, skill_id)
);

-- ============================================
-- TRACK B: INTELLIGENT WORKFLOW AUTOMATION
-- ============================================

-- AI-generated workflow plans
create table if not exists nofx.workflow_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  plan_graph jsonb not null, -- DAG representation
  optimization_metadata jsonb,
  performance_metrics jsonb,
  template_id uuid references nofx.template_registry(id),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Workflow execution tracking
create table if not exists nofx.workflow_executions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references nofx.workflow_plans(id),
  session_id uuid references nofx.agent_sessions(id),
  execution_context jsonb,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  performance_data jsonb,
  adaptations_made jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

-- Runtime workflow adaptations
create table if not exists nofx.workflow_adaptations (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references nofx.workflow_executions(id) on delete cascade,
  adaptation_type text not null,
  reason text,
  changes_made jsonb not null,
  performance_impact jsonb,
  applied_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Workflow dependency graph
create table if not exists nofx.workflow_dependencies (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references nofx.workflow_plans(id) on delete cascade,
  from_step text not null,
  to_step text not null,
  dependency_type text not null check (dependency_type in ('sequential', 'parallel', 'conditional')),
  condition jsonb,
  created_at timestamptz not null default now(),
  unique(plan_id, from_step, to_step)
);

-- ============================================
-- TRACK C: PREDICTIVE OPERATIONS & ANALYTICS
-- ============================================

-- Machine learning models for predictions
create table if not exists nofx.prediction_models (
  id uuid primary key default gen_random_uuid(),
  model_type text not null,
  model_version text not null,
  model_data jsonb not null,
  training_data_stats jsonb,
  accuracy_metrics jsonb,
  last_trained_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(model_type, model_version)
);

-- Operational predictions
create table if not exists nofx.operational_predictions (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references nofx.prediction_models(id),
  prediction_type text not null,
  target_entity_type text,
  target_entity_id text,
  prediction_data jsonb not null,
  confidence_level decimal(5,4) check (confidence_level between 0 and 1),
  predicted_for timestamptz not null,
  actual_outcome jsonb,
  accuracy_score decimal(5,4),
  created_at timestamptz not null default now()
);

-- Analytics insights and recommendations
create table if not exists nofx.analytics_insights (
  id uuid primary key default gen_random_uuid(),
  insight_type text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  insight_data jsonb not null,
  impact_score decimal(5,2),
  action_recommendations jsonb,
  is_acknowledged boolean not null default false,
  acknowledged_by text,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

-- Performance benchmarks
create table if not exists nofx.performance_benchmarks (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  metric_name text not null,
  metric_value decimal,
  metric_unit text,
  benchmark_period text not null,
  percentile_rank decimal(5,2),
  created_at timestamptz not null default now(),
  unique(entity_type, entity_id, metric_name, benchmark_period)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Orchestration indexes
create index if not exists agent_sessions_status_idx on nofx.agent_sessions (status, created_at desc);
create index if not exists agent_sessions_type_idx on nofx.agent_sessions (orchestration_type);
create index if not exists agent_relationships_session_idx on nofx.agent_relationships (session_id);
create index if not exists agent_communications_session_idx on nofx.agent_communications (session_id, created_at);
create index if not exists agent_communications_agents_idx on nofx.agent_communications (from_agent_id, to_agent_id);
create index if not exists agent_capabilities_agent_idx on nofx.agent_capabilities (agent_id);
create index if not exists agent_capabilities_skill_idx on nofx.agent_capabilities (skill_id, success_rate desc);

-- Workflow indexes
create index if not exists workflow_plans_updated_idx on nofx.workflow_plans (updated_at desc);
create index if not exists workflow_executions_plan_idx on nofx.workflow_executions (plan_id);
create index if not exists workflow_executions_status_idx on nofx.workflow_executions (status, created_at desc);
create index if not exists workflow_adaptations_execution_idx on nofx.workflow_adaptations (execution_id);
create index if not exists workflow_dependencies_plan_idx on nofx.workflow_dependencies (plan_id);

-- Analytics indexes
create index if not exists prediction_models_type_idx on nofx.prediction_models (model_type, is_active);
create index if not exists operational_predictions_model_idx on nofx.operational_predictions (model_id);
create index if not exists operational_predictions_type_idx on nofx.operational_predictions (prediction_type, predicted_for desc);
create index if not exists analytics_insights_type_idx on nofx.analytics_insights (insight_type, severity);
create index if not exists analytics_insights_acknowledged_idx on nofx.analytics_insights (is_acknowledged, created_at desc);
create index if not exists performance_benchmarks_entity_idx on nofx.performance_benchmarks (entity_type, entity_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table nofx.agent_sessions enable row level security;
alter table nofx.agent_relationships enable row level security;
alter table nofx.agent_communications enable row level security;
alter table nofx.agent_capabilities enable row level security;
alter table nofx.workflow_plans enable row level security;
alter table nofx.workflow_executions enable row level security;
alter table nofx.workflow_adaptations enable row level security;
alter table nofx.workflow_dependencies enable row level security;
alter table nofx.prediction_models enable row level security;
alter table nofx.operational_predictions enable row level security;
alter table nofx.analytics_insights enable row level security;
alter table nofx.performance_benchmarks enable row level security;

-- Admin policies (to be refined based on actual auth requirements)
create policy agent_sessions_admin on nofx.agent_sessions for all using (true) with check (true);
create policy agent_relationships_admin on nofx.agent_relationships for all using (true) with check (true);
create policy agent_communications_admin on nofx.agent_communications for all using (true) with check (true);
create policy agent_capabilities_admin on nofx.agent_capabilities for all using (true) with check (true);
create policy workflow_plans_admin on nofx.workflow_plans for all using (true) with check (true);
create policy workflow_executions_admin on nofx.workflow_executions for all using (true) with check (true);
create policy workflow_adaptations_admin on nofx.workflow_adaptations for all using (true) with check (true);
create policy workflow_dependencies_admin on nofx.workflow_dependencies for all using (true) with check (true);
create policy prediction_models_admin on nofx.prediction_models for all using (true) with check (true);
create policy operational_predictions_admin on nofx.operational_predictions for all using (true) with check (true);
create policy analytics_insights_admin on nofx.analytics_insights for all using (true) with check (true);
create policy performance_benchmarks_admin on nofx.performance_benchmarks for all using (true) with check (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to calculate agent performance score
create or replace function nofx.calculate_agent_performance_score(p_agent_id uuid)
returns decimal as $$
declare
  v_score decimal;
begin
  select
    avg(success_rate * 100) into v_score
  from nofx.agent_capabilities
  where agent_id = p_agent_id;

  return coalesce(v_score, 0);
end;
$$ language plpgsql;

-- Function to get optimal agent for a skill
create or replace function nofx.get_optimal_agent_for_skill(p_skill_id text)
returns uuid as $$
declare
  v_agent_id uuid;
begin
  select
    agent_id into v_agent_id
  from nofx.agent_capabilities
  where skill_id = p_skill_id
    and success_rate > 0.8
  order by
    success_rate desc,
    average_latency_ms asc,
    cost_per_operation asc
  limit 1;

  return v_agent_id;
end;
$$ language plpgsql;

-- Trigger to update workflow plan timestamps
create or replace function nofx.update_workflow_plan_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger workflow_plans_updated_trigger
  before update on nofx.workflow_plans
  for each row execute function nofx.update_workflow_plan_timestamp();

-- ============================================
-- INITIAL DATA (OPTIONAL)
-- ============================================

-- Insert default prediction model types
insert into nofx.prediction_models (model_type, model_version, model_data, is_active)
values
  ('failure_prediction', '1.0.0', '{"algorithm": "random_forest", "features": ["error_rate", "latency", "resource_usage"]}'::jsonb, true),
  ('resource_forecast', '1.0.0', '{"algorithm": "time_series", "window": "7d", "granularity": "1h"}'::jsonb, true),
  ('cost_optimization', '1.0.0', '{"algorithm": "linear_regression", "target": "cost_reduction"}'::jsonb, true)
on conflict do nothing;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

comment on table nofx.agent_sessions is 'Multi-agent orchestration sessions tracking different coordination patterns';
comment on table nofx.agent_relationships is 'Hierarchical relationships between agents in orchestration sessions';
comment on table nofx.agent_communications is 'Inter-agent messaging and communication logs';
comment on table nofx.agent_capabilities is 'Agent skill profiles for capability-based routing and selection';
comment on table nofx.workflow_plans is 'AI-generated workflow execution plans with optimization metadata';
comment on table nofx.workflow_executions is 'Runtime tracking of workflow plan executions';
comment on table nofx.workflow_adaptations is 'Runtime modifications made to workflows during execution';
comment on table nofx.workflow_dependencies is 'Dependency graph for workflow step execution ordering';
comment on table nofx.prediction_models is 'Machine learning models for operational predictions';
comment on table nofx.operational_predictions is 'Predictions for system behavior and resource needs';
comment on table nofx.analytics_insights is 'Business intelligence insights and recommendations';
comment on table nofx.performance_benchmarks is 'Performance metrics and comparative benchmarks';

comment on column nofx.agent_sessions.orchestration_type is 'Pattern type: solo (single agent), pair (two agents), hierarchical (supervisor/worker), swarm (collaborative cluster)';
comment on column nofx.workflow_plans.plan_graph is 'DAG representation of workflow steps and dependencies';
comment on column nofx.operational_predictions.confidence_level is 'Model confidence in prediction (0-1)';
comment on column nofx.analytics_insights.impact_score is 'Estimated business impact score (0-100)';
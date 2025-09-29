create table if not exists nofx.model (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'local',
  name text not null,                    -- provider-specific model identifier
  display_name text,                     -- human label
  provider text not null,                -- e.g., openai, anthropic, gemini, grok, local
  kind text not null default 'openai',   -- 'openai'|'anthropic'|'gemini'|'openai-compatible'|'http'
  base_url text,                         -- for non-builtins
  input_per_1m numeric,                  -- USD per 1M input tokens
  output_per_1m numeric,                 -- USD per 1M output tokens
  context_tokens int,                    -- optional published context window
  max_output_tokens int,                 -- optional published max output
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists model_unique on nofx.model(tenant_id, provider, name);

-- Workstream 01 — Reliability: Idempotency + Inbox/Outbox
-- 1) Add idempotency columns
ALTER TABLE nofx.step ADD COLUMN IF NOT EXISTS idempotency_key text UNIQUE;
ALTER TABLE nofx.event ADD COLUMN IF NOT EXISTS idempotency_key text;

-- 2) Inbox table (exactly-once delivery guard)
CREATE TABLE IF NOT EXISTS nofx.inbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'local',
  key text not null,
  created_at timestamptz not null default now(),
  UNIQUE(tenant_id, key)
);

-- 3) Outbox table (reliable event relay)
CREATE TABLE IF NOT EXISTS nofx.outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'local',
  topic text not null,
  payload jsonb not null,
  sent boolean not null default false,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS outbox_unsent_idx ON nofx.outbox(sent) WHERE sent = false;


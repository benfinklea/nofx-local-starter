-- Template analytics and feedback tables for Phase 1B
set search_path = public;

create schema if not exists nofx;

create table if not exists nofx.template_usage_daily (
  template_id uuid not null references nofx.template_registry(id) on delete cascade,
  day date not null,
  usage_count integer not null default 0,
  success_count integer not null default 0,
  total_duration_ms bigint not null default 0,
  total_token_usage bigint not null default 0,
  last_run_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint template_usage_daily_pk primary key (template_id, day)
);

create index if not exists template_usage_daily_day_idx on nofx.template_usage_daily (day);
create index if not exists template_usage_daily_template_idx on nofx.template_usage_daily (template_id);

create table if not exists nofx.template_feedback (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references nofx.template_registry(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  submitted_by text,
  submitted_at timestamptz not null default now()
);

create index if not exists template_feedback_template_idx on nofx.template_feedback (template_id);
create index if not exists template_feedback_rating_idx on nofx.template_feedback (rating);

alter table nofx.template_usage_daily enable row level security;
alter table nofx.template_feedback enable row level security;

create policy template_usage_daily_admin_full on nofx.template_usage_daily
  for all using (true) with check (true);

create policy template_feedback_admin_full on nofx.template_feedback
  for all using (true) with check (true);


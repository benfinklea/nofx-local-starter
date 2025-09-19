-- Projects and per-run project association
create table if not exists nofx.project (
  id text primary key default 'default',
  tenant_id text not null default 'local',
  name text not null default 'Default Project',
  repo_url text,
  local_path text,
  workspace_mode text not null default 'local_path', -- 'local_path'|'clone'|'worktree'
  default_branch text not null default 'main',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- seed default project row
insert into nofx.project (id, name)
  values ('default','Default Project')
on conflict (id) do nothing;

-- add project_id to run and backfill default
alter table nofx.run add column if not exists project_id text not null default 'default';
alter table nofx.run add constraint run_project_fk foreign key (project_id) references nofx.project(id) on update cascade on delete restrict;
create index if not exists run_project_idx on nofx.run(project_id);


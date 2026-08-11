-- Dispatch — core schema
-- Design notes live in docs/write-up.md. Summary of the choices made here:
--
--  * Every tenant-scoped table carries org_id directly (not just via a join
--    chain) so Hasura permission checks and indexes stay O(1) hops instead of
--    walking workflow -> workflow_run -> ... on every row check.
--  * Roles are NOT modeled as Hasura roles. A user's role is per-organization
--    (owner in Org A, viewer in Org B is a valid state), so role lives in
--    org_members and every permission is a relationship check against it,
--    under a single "user" Hasura role. See docs/write-up.md.
--  * workflow_runs / step_runs have no direct insert/update permission for
--    end users — they are only ever written by the triggerWorkflowRun /
--    approveStep Action handlers (using the admin secret), which is where
--    quota checks, retries and the approval-gate role check actually live.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  quota_calls_allowed integer not null default 100,
  quota_calls_used integer not null default 0,
  quota_period_start timestamptz not null default date_trunc('month', now()),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.organizations.quota_calls_allowed is
  'external calls (llm_call + http_request) allowed per quota_period_start..+1 month';
comment on column public.organizations.quota_calls_used is
  'incremented by the run engine on every completed llm_call/http_request step';

-- ---------------------------------------------------------------------------
-- org_members — per-org role. A user can be a member of many orgs with a
-- different role in each.
-- ---------------------------------------------------------------------------
create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index org_members_user_id_idx on public.org_members(user_id);
create index org_members_org_id_idx on public.org_members(org_id);

-- ---------------------------------------------------------------------------
-- workflows
-- ---------------------------------------------------------------------------
create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workflows_org_id_idx on public.workflows(org_id);

-- ---------------------------------------------------------------------------
-- workflow_steps — ordered, typed, JSONB config per type.
-- ---------------------------------------------------------------------------
create table public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  step_order integer not null,
  type text not null check (type in (
    'llm_call', 'http_request', 'db_write', 'notify',
    'conditional_branch', 'approval_gate'
  )),
  name text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_id, step_order)
);

create index workflow_steps_workflow_id_idx on public.workflow_steps(workflow_id);
create index workflow_steps_org_id_idx on public.workflow_steps(org_id);

-- ---------------------------------------------------------------------------
-- workflow_triggers
-- ---------------------------------------------------------------------------
create table public.workflow_triggers (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  type text not null check (type in ('manual', 'webhook', 'scheduled', 'database_event')),
  config jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workflow_triggers_workflow_id_idx on public.workflow_triggers(workflow_id);
create index workflow_triggers_org_id_idx on public.workflow_triggers(org_id);
-- database_event triggers are looked up by watched table name at insert time
create index workflow_triggers_watched_table_idx
  on public.workflow_triggers (((config->>'watched_table')))
  where type = 'database_event' and is_enabled;

-- ---------------------------------------------------------------------------
-- workflow_runs
-- ---------------------------------------------------------------------------
create table public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'pending' check (status in (
    'pending', 'running', 'paused', 'succeeded', 'failed', 'cancelled'
  )),
  trigger_type text not null check (trigger_type in ('manual', 'webhook', 'scheduled', 'database_event')),
  triggered_by uuid references auth.users(id) on delete set null,
  trigger_context jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index workflow_runs_workflow_id_idx on public.workflow_runs(workflow_id);
create index workflow_runs_org_id_idx on public.workflow_runs(org_id);
create index workflow_runs_status_idx on public.workflow_runs(status);

-- ---------------------------------------------------------------------------
-- step_runs
-- ---------------------------------------------------------------------------
create table public.step_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references public.workflow_runs(id) on delete cascade,
  workflow_step_id uuid not null references public.workflow_steps(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'pending' check (status in (
    'pending', 'running', 'succeeded', 'failed', 'paused', 'skipped'
  )),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  attempt_count integer not null default 0,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index step_runs_workflow_run_id_idx on public.step_runs(workflow_run_id);
create index step_runs_org_id_idx on public.step_runs(org_id);
create index step_runs_status_idx on public.step_runs(status);

-- ---------------------------------------------------------------------------
-- notifications — the `notify` step type never sends anything itself. The
-- run engine only inserts a row here; a Hasura Event Trigger on INSERT is
-- what actually fires the Slack/email webhook. This is deliberate: it's the
-- assignment's requirement that `notify` be "implemented as an Event
-- Trigger", and it also means notification delivery can be retried /
-- observed independently of the step that requested it.
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  step_run_id uuid references public.step_runs(id) on delete cascade,
  workflow_run_id uuid references public.workflow_runs(id) on delete cascade,
  channel text not null check (channel in ('slack', 'email')),
  target text not null,
  message text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index notifications_org_id_idx on public.notifications(org_id);

-- ---------------------------------------------------------------------------
-- workflow_outputs — where `db_write` steps actually land data. Kept
-- separate from step_runs.output (which is the step's raw execution
-- record) because db_write's whole point is "save a result into MY tables"
-- as a distinct, queryable, org-scoped resource.
-- ---------------------------------------------------------------------------
create table public.workflow_outputs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  workflow_run_id uuid not null references public.workflow_runs(id) on delete cascade,
  step_run_id uuid not null references public.step_runs(id) on delete cascade,
  key text not null,
  value jsonb not null,
  created_at timestamptz not null default now()
);

create index workflow_outputs_org_id_idx on public.workflow_outputs(org_id);
create index workflow_outputs_workflow_run_id_idx on public.workflow_outputs(workflow_run_id);

-- ---------------------------------------------------------------------------
-- leads — a small stand-in "real" business table so the database_event
-- trigger has something plausible to watch (e.g. "auto-run the lead
-- enrichment workflow whenever a new lead comes in"), instead of a
-- contrived table that only exists to prove the feature works.
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text not null,
  source text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index leads_org_id_idx on public.leads(org_id);

-- ---------------------------------------------------------------------------
-- computed field: average completed-run duration per workflow
-- ---------------------------------------------------------------------------
create function public.workflow_avg_duration_seconds(workflow_row public.workflows)
returns numeric as $$
  select avg(extract(epoch from (finished_at - started_at)))
  from public.workflow_runs
  where workflow_id = workflow_row.id
    and finished_at is not null;
$$ language sql stable;

-- ---------------------------------------------------------------------------
-- view: org usage for the current quota period (calls used/allowed, run
-- counts, avg run duration) — the "org-level usage this month" aggregation.
-- ---------------------------------------------------------------------------
create view public.org_usage_current_period as
select
  o.id as org_id,
  o.quota_period_start,
  o.quota_calls_allowed,
  o.quota_calls_used,
  greatest(o.quota_calls_allowed - o.quota_calls_used, 0) as quota_calls_remaining,
  count(distinct wr.id) filter (
    where wr.created_at >= o.quota_period_start
  ) as runs_this_period,
  count(distinct wr.id) filter (
    where wr.created_at >= o.quota_period_start and wr.status = 'failed'
  ) as failed_runs_this_period,
  avg(extract(epoch from (wr.finished_at - wr.started_at))) filter (
    where wr.finished_at is not null and wr.created_at >= o.quota_period_start
  ) as avg_run_duration_seconds
from public.organizations o
left join public.workflows w on w.org_id = o.id
left join public.workflow_runs wr on wr.workflow_id = w.id
group by o.id;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.organizations
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on public.workflows
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on public.workflow_steps
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on public.workflow_triggers
  for each row execute procedure public.set_updated_at();

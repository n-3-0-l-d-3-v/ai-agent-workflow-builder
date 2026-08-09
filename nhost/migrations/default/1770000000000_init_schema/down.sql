drop trigger if exists set_updated_at on public.workflow_triggers;
drop trigger if exists set_updated_at on public.workflow_steps;
drop trigger if exists set_updated_at on public.workflows;
drop trigger if exists set_updated_at on public.organizations;
drop function if exists public.set_updated_at();

drop view if exists public.org_usage_current_period;
drop function if exists public.workflow_avg_duration_seconds(public.workflows);

drop table if exists public.leads;
drop table if exists public.workflow_outputs;
drop table if exists public.notifications;
drop table if exists public.step_runs;
drop table if exists public.workflow_runs;
drop table if exists public.workflow_triggers;
drop table if exists public.workflow_steps;
drop table if exists public.workflows;
drop table if exists public.org_members;
drop table if exists public.organizations;

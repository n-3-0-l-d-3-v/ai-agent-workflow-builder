drop trigger if exists bootstrap_org_owner on public.organizations;
drop function if exists public.bootstrap_org_owner();
alter table public.organizations drop column if exists created_by;

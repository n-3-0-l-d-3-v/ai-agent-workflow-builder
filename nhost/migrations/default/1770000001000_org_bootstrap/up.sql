-- Bootstraps the owner membership row atomically when an org is created,
-- so "create an org" can be a plain Hasura insert permission (checked
-- against created_by = the caller) instead of needing a custom Action just
-- to avoid the chicken-and-egg problem of "you must be a member to be
-- allowed to create the org that would make you a member".
alter table public.organizations
  add column created_by uuid references auth.users(id) on delete set null;

create function public.bootstrap_org_owner()
returns trigger as $$
begin
  if new.created_by is not null then
    insert into public.org_members (org_id, user_id, role)
    values (new.id, new.created_by, 'owner');
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger bootstrap_org_owner
  after insert on public.organizations
  for each row execute procedure public.bootstrap_org_owner();

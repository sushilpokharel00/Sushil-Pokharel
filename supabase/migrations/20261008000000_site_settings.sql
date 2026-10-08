create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  is_maintenance boolean not null default true,
  maintenance_title text not null default 'We’re making improvements.'
    check (char_length(maintenance_title) between 1 and 120),
  maintenance_message text not null default 'The website is temporarily under maintenance while we work on updates. There’s no confirmed reopening date yet. In the meantime, contact Sushil or request beta access.'
    check (char_length(maintenance_message) between 1 and 500),
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant update on public.site_settings to authenticated;

drop policy if exists "Site settings are publicly readable" on public.site_settings;
create policy "Site settings are publicly readable"
  on public.site_settings
  for select
  using (true);

drop policy if exists "Admins with MFA can update site settings" on public.site_settings;
create policy "Admins with MFA can update site settings"
  on public.site_settings
  for update
  to authenticated
  using (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    and auth.jwt() ->> 'aal' = 'aal2'
  )
  with check (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    and auth.jwt() ->> 'aal' = 'aal2'
  );

create or replace function public.set_site_settings_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_site_settings_updated_at on public.site_settings;
create trigger set_site_settings_updated_at
  before update on public.site_settings
  for each row
  execute function public.set_site_settings_updated_at();

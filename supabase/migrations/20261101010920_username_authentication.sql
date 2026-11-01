alter table public.profiles
  add column if not exists username text;

insert into public.profiles (user_id, full_name, username)
select
  users.id,
  left(coalesce(users.raw_user_meta_data ->> 'full_name', ''), 100),
  null
from auth.users as users
left join public.profiles as profiles on profiles.user_id = users.id
where profiles.user_id is null;

update public.profiles
set username = case
  when numbered_profiles.username_candidate ~ '^[a-z0-9][a-z0-9._-]{2,31}$'
    and numbered_profiles.candidate_count = 1
    then numbered_profiles.username_candidate
  else 'member_' || substr(replace(numbered_profiles.user_id::text, '-', ''), 1, 25)
end
from (
  select
    profiles.user_id,
    lower(regexp_replace(split_part(coalesce(users.email, ''), '@', 1), '[^a-z0-9._-]', '', 'g')) as username_candidate,
    count(*) over (
      partition by lower(regexp_replace(split_part(coalesce(users.email, ''), '@', 1), '[^a-z0-9._-]', '', 'g'))
    ) as candidate_count
  from public.profiles as profiles
  left join auth.users as users on users.id = profiles.user_id
  where profiles.username is null
) as numbered_profiles
where public.profiles.user_id = numbered_profiles.user_id;

alter table public.profiles
  alter column username set not null,
  add constraint profiles_username_format
    check (username = lower(username) and username ~ '^[a-z0-9][a-z0-9._-]{2,31}$');

create unique index profiles_username_unique_idx
  on public.profiles (username);

grant insert (user_id, full_name, email_notifications, avatar_path, username)
  on public.profiles to authenticated;
grant update (user_id, full_name, email_notifications, avatar_path, username)
  on public.profiles to authenticated;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
begin
  requested_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  if requested_username = '' then
    requested_username := 'member_' || substr(replace(new.id::text, '-', ''), 1, 25);
  elsif requested_username !~ '^[a-z0-9][a-z0-9._-]{2,31}$' then
    raise exception 'A valid username is required.';
  end if;

  insert into public.profiles (user_id, full_name, username)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 100),
    requested_username
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;
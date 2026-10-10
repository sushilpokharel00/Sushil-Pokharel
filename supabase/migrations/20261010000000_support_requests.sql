alter table public.site_settings
  add column if not exists support_online boolean not null default false;

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requester_email text not null check (char_length(requester_email) between 3 and 254),
  subject text not null check (char_length(subject) between 1 and 120),
  message text not null check (char_length(message) between 1 and 3000),
  admin_reply text check (admin_reply is null or char_length(admin_reply) between 1 and 3000),
  created_at timestamptz not null default now(),
  replied_at timestamptz
);

create index if not exists support_requests_user_created_idx
  on public.support_requests (user_id, created_at desc);

alter table public.support_requests enable row level security;

revoke all on public.support_requests from anon, authenticated;
grant select, insert, update on public.support_requests to authenticated;

drop policy if exists "Users can create their own support requests" on public.support_requests;
create policy "Users can create their own support requests"
  on public.support_requests
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and auth.jwt() ->> 'email' = requester_email
  );

drop policy if exists "Users can read their own support requests" on public.support_requests;
create policy "Users can read their own support requests"
  on public.support_requests
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or (
      auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
      and auth.jwt() ->> 'aal' = 'aal2'
    )
  );

drop policy if exists "Admins with MFA can reply to support requests" on public.support_requests;
create policy "Admins with MFA can reply to support requests"
  on public.support_requests
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

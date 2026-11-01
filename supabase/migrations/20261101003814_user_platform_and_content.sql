alter table public.site_settings
  add column if not exists site_name text not null default 'Sushil Pokharel'
    check (char_length(site_name) between 1 and 100),
  add column if not exists site_description text not null default 'Website information, account and support tools, policies, and Android app details from Sushil Pokharel in Bhaktapur, Nepal.'
    check (char_length(site_description) between 1 and 300);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  avatar_path text,
  email_notifications boolean not null default true,
  newsletter_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (user_id, full_name, email_notifications, avatar_path) on public.profiles to authenticated;
grant update (user_id, full_name, email_notifications, avatar_path) on public.profiles to authenticated;

create policy "Users read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 100))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

create table if not exists public.user_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  content text not null check (char_length(content) between 20 and 20000),
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'rejected')),
  moderation_note text,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists user_posts_owner_updated_idx
  on public.user_posts (user_id, updated_at desc);
create index if not exists user_posts_public_updated_idx
  on public.user_posts (updated_at desc)
  where status = 'approved';
create index if not exists user_posts_review_queue_idx
  on public.user_posts (created_at)
  where status = 'pending';

alter table public.user_posts enable row level security;
revoke all on public.user_posts from anon, authenticated;
grant select, insert, update, delete on public.user_posts to authenticated;
grant select on public.user_posts to anon;

create policy "Anyone reads approved posts"
  on public.user_posts for select to anon, authenticated
  using (
    status = 'approved'
    or (select auth.uid()) = user_id
    or (
      (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

create policy "Users create their own drafts"
  on public.user_posts for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'draft'
    and featured = false
    and moderation_note is null
    and reviewed_at is null
  );

create policy "Users edit their own unapproved posts"
  on public.user_posts for update to authenticated
  using (
    (select auth.uid()) = user_id
    and status in ('draft', 'pending', 'rejected')
  )
  with check (
    (select auth.uid()) = user_id
    and status in ('draft', 'pending', 'rejected')
    and featured = false
    and moderation_note is null
    and reviewed_at is null
  );

create policy "Users delete their own posts"
  on public.user_posts for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users withdraw approved posts for revision"
  on public.user_posts for update to authenticated
  using ((select auth.uid()) = user_id and status = 'approved')
  with check (
    (select auth.uid()) = user_id
    and status = 'draft'
    and featured = false
    and moderation_note is null
    and reviewed_at is null
  );

create policy "Admins moderate posts with MFA"
  on public.user_posts for all to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 160),
  body text not null check (char_length(body) between 1 and 10000),
  published boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists announcements_published_idx
  on public.announcements (published_at desc)
  where published;
alter table public.announcements enable row level security;
revoke all on public.announcements from anon, authenticated;
grant select, insert, update, delete on public.announcements to authenticated;
grant select on public.announcements to anon;

create policy "Users read published announcements"
  on public.announcements for select to anon, authenticated
  using (
    published
    or (
      (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

create policy "Admins manage announcements with MFA"
  on public.announcements for all to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_user_posts_updated_at on public.user_posts;
create trigger set_user_posts_updated_at
  before update on public.user_posts
  for each row execute function public.set_updated_at();

drop trigger if exists set_announcements_updated_at on public.announcements;
create trigger set_announcements_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null unique check (char_length(email) between 3 and 254),
  status text not null default 'pending'
    check (status in ('pending', 'subscribed', 'unsubscribed')),
  confirmation_token_hash text,
  token_expires_at timestamptz,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint newsletter_token_required
    check (status <> 'pending' or confirmation_token_hash is not null)
);

create index if not exists newsletter_subscribers_status_idx
  on public.newsletter_subscribers (created_at desc)
  where status = 'subscribed';
alter table public.newsletter_subscribers enable row level security;
revoke all on public.newsletter_subscribers from anon, authenticated;

create table if not exists public.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (char_length(subject) between 3 and 200),
  body text not null check (char_length(body) between 1 and 20000),
  status text not null default 'draft'
    check (status in ('draft', 'sending', 'sent', 'failed')),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  sent_by uuid references auth.users (id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.newsletter_campaigns enable row level security;
revoke all on public.newsletter_campaigns from anon, authenticated;

create table if not exists public.user_activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  event text not null check (event in ('profile_updated', 'post_created', 'post_updated', 'post_submitted', 'post_deleted')),
  created_at timestamptz not null default now()
);
create index if not exists user_activity_owner_created_idx
  on public.user_activity (user_id, created_at desc);
alter table public.user_activity enable row level security;
revoke all on public.user_activity from anon, authenticated;
grant select on public.user_activity to authenticated;
create policy "Users read their own activity"
  on public.user_activity for select to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  visitor_hash text not null,
  page_path text not null check (char_length(page_path) between 1 and 200),
  viewed_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (visitor_hash, page_path, viewed_on)
);
create index if not exists page_views_viewed_on_idx
  on public.page_views (viewed_on desc);
alter table public.page_views enable row level security;
revoke all on public.page_views from anon, authenticated;

create or replace function public.record_user_content_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  activity_event text;
begin
  if tg_table_name = 'profiles' then
    target_user_id := new.user_id;
    activity_event := 'profile_updated';
  else
    target_user_id := coalesce(new.user_id, old.user_id);
    if tg_op = 'INSERT' then
      activity_event := 'post_created';
    elsif tg_op = 'DELETE' then
      activity_event := 'post_deleted';
    elsif old.status is distinct from new.status and new.status = 'pending' then
      activity_event := 'post_submitted';
    else
      activity_event := 'post_updated';
    end if;
  end if;

  insert into public.user_activity (user_id, event)
  values (target_user_id, activity_event);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.record_user_content_activity() from public, anon, authenticated;

drop trigger if exists record_profile_activity on public.profiles;
create trigger record_profile_activity
  after update on public.profiles
  for each row execute function public.record_user_content_activity();

drop trigger if exists record_post_activity on public.user_posts;
create trigger record_post_activity
  after insert or update or delete on public.user_posts
  for each row execute function public.record_user_content_activity();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Users upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users replace their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users remove their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
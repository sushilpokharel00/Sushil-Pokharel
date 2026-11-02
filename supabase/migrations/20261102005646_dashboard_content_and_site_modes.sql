alter table public.user_posts
  add column if not exists category text not null default 'other',
  add column if not exists featured_image_path text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_posts_category_check'
      and conrelid = 'public.user_posts'::regclass
  ) then
    alter table public.user_posts
      add constraint user_posts_category_check
      check (category in ('announcement', 'story', 'question', 'project', 'other'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_posts_featured_image_path_check'
      and conrelid = 'public.user_posts'::regclass
  ) then
    alter table public.user_posts
      add constraint user_posts_featured_image_path_check
      check (
        featured_image_path is null
        or (
          char_length(featured_image_path) between 1 and 200
          and featured_image_path !~ '(^/|(^|/)\.\.(/|$))'
        )
      );
  end if;
end;
$$;

drop policy if exists "Users create their own drafts" on public.user_posts;
create policy "Users create their own drafts"
  on public.user_posts for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'draft'
    and featured = false
    and moderation_note is null
    and reviewed_at is null
    and (
      featured_image_path is null
      or split_part(featured_image_path, '/', 1) = (select auth.uid()::text)
    )
  );

drop policy if exists "Users edit their own unapproved posts" on public.user_posts;
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
    and (
      featured_image_path is null
      or split_part(featured_image_path, '/', 1) = (select auth.uid()::text)
    )
  );

drop policy if exists "Users withdraw approved posts for revision" on public.user_posts;
create policy "Users withdraw approved posts for revision"
  on public.user_posts for update to authenticated
  using ((select auth.uid()) = user_id and status = 'approved')
  with check (
    (select auth.uid()) = user_id
    and status = 'draft'
    and featured = false
    and moderation_note is null
    and reviewed_at is null
    and (
      featured_image_path is null
      or split_part(featured_image_path, '/', 1) = (select auth.uid()::text)
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-post-images',
  'user-post-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authors and admins read post images" on storage.objects;
create policy "Authors and admins read post images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'user-post-images'
    and (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      or (
        (select auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
        and (select auth.jwt() ->> 'aal') = 'aal2'
      )
    )
  );

drop policy if exists "Authors upload post images" on storage.objects;
create policy "Authors upload post images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'user-post-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Authors update post images" on storage.objects;
create policy "Authors update post images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'user-post-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'user-post-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Authors delete post images" on storage.objects;
create policy "Authors delete post images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'user-post-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

alter table public.site_settings
  add column if not exists site_status text not null default 'maintenance';

update public.site_settings
set site_status = case when is_maintenance then 'maintenance' else 'live' end;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'site_settings_site_status_check'
      and conrelid = 'public.site_settings'::regclass
  ) then
    alter table public.site_settings
      add constraint site_settings_site_status_check
      check (site_status in ('live', 'maintenance', 'offline'));
  end if;
end;
$$;

create or replace function public.sync_site_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.site_status is distinct from old.site_status then
    new.is_maintenance := new.site_status = 'maintenance';
  elsif new.is_maintenance is distinct from old.is_maintenance then
    new.site_status := case when new.is_maintenance then 'maintenance' else 'live' end;
  else
    new.is_maintenance := new.site_status = 'maintenance';
  end if;
  return new;
end;
$$;

revoke all on function public.sync_site_status() from public, anon, authenticated;

drop trigger if exists sync_site_status_before_write on public.site_settings;
create trigger sync_site_status_before_write
  before insert or update on public.site_settings
  for each row execute function public.sync_site_status();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'site_settings'
    ) then
    alter publication supabase_realtime add table public.site_settings;
  end if;
end;
$$;

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) between 3 and 100),
  resource_type text not null check (char_length(resource_type) between 1 and 80),
  resource_id text check (resource_id is null or char_length(resource_id) <= 100),
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_actor_created_idx
  on public.admin_audit_log (actor_id, created_at desc);

alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;
grant insert on public.admin_audit_log to service_role;
grant usage, select on sequence public.admin_audit_log_id_seq to service_role;

create policy "Super admins with MFA read audit log"
  on public.admin_audit_log for select to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'admin_audit_log'
    ) then
    alter publication supabase_realtime add table public.admin_audit_log;
  end if;
end;
$$;

create or replace function public.audit_admin_content_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_action text;
  resource_key text;
begin
  if (select auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'super_admin'
    or (select auth.jwt() ->> 'aal') is distinct from 'aal2'
    or (select auth.uid()) is null then
    return new;
  end if;

  if tg_table_name = 'site_settings' then
    audit_action := 'site_status_updated';
    resource_key := new.id::text;
  elsif tg_table_name = 'user_posts' then
    if tg_op = 'DELETE' then
      audit_action := 'post_deleted';
      resource_key := old.id::text;
    else
      audit_action := case
        when old.status is distinct from new.status then 'post_' || new.status
        else 'post_updated'
      end;
      resource_key := new.id::text;
    end if;
  elsif tg_table_name = 'announcements' then
    if tg_op = 'DELETE' then
      audit_action := 'announcement_deleted';
      resource_key := old.id::text;
    else
      audit_action := case when new.published then 'announcement_published' else 'announcement_updated' end;
      resource_key := new.id::text;
    end if;
  elsif tg_table_name = 'support_requests' then
    audit_action := 'support_reply_updated';
    resource_key := new.id::text;
  else
    return new;
  end if;

  insert into public.admin_audit_log (actor_id, action, resource_type, resource_id)
  values ((select auth.uid()), audit_action, tg_table_name, resource_key);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.audit_admin_content_changes() from public, anon, authenticated;

drop trigger if exists audit_site_settings_changes on public.site_settings;
create trigger audit_site_settings_changes
  after update on public.site_settings
  for each row execute function public.audit_admin_content_changes();

drop trigger if exists audit_admin_post_moderation on public.user_posts;
create trigger audit_admin_post_moderation
  after update or delete on public.user_posts
  for each row execute function public.audit_admin_content_changes();

drop trigger if exists audit_admin_announcement_changes on public.announcements;
create trigger audit_admin_announcement_changes
  after insert or update or delete on public.announcements
  for each row execute function public.audit_admin_content_changes();

drop trigger if exists audit_admin_support_replies on public.support_requests;
create trigger audit_admin_support_replies
  after update on public.support_requests
  for each row execute function public.audit_admin_content_changes();
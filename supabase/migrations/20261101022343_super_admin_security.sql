drop policy if exists "Admins with MFA can update site settings" on public.site_settings;
create policy "Super admins with MFA can update site settings"
  on public.site_settings
  for update
  to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

drop policy if exists "Users can read their own support requests" on public.support_requests;
create policy "Users can read their own support requests"
  on public.support_requests
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (
      (select auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

drop policy if exists "Admins with MFA can reply to support requests" on public.support_requests;
create policy "Super admins with MFA can reply to support requests"
  on public.support_requests
  for update
  to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

drop policy if exists "Anyone reads approved posts" on public.user_posts;
create policy "Anyone reads approved posts"
  on public.user_posts
  for select
  to anon, authenticated
  using (
    status = 'approved'
    or (select auth.uid()) = user_id
    or (
      (select auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

drop policy if exists "Admins moderate posts with MFA" on public.user_posts;
create policy "Super admins moderate posts with MFA"
  on public.user_posts
  for all
  to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

drop policy if exists "Users read published announcements" on public.announcements;
create policy "Users read published announcements"
  on public.announcements
  for select
  to anon, authenticated
  using (
    published
    or (
      (select auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

drop policy if exists "Admins manage announcements with MFA" on public.announcements;
create policy "Super admins manage announcements with MFA"
  on public.announcements
  for all
  to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );
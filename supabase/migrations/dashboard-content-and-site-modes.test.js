import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('./20261102005646_dashboard_content_and_site_modes.sql', import.meta.url);
const sql = await readFile(migrationUrl, 'utf8');

test('post categories and featured images have database constraints', () => {
  assert.match(sql, /add column if not exists category text not null default 'other'/);
  assert.match(sql, /category in \('announcement', 'story', 'question', 'project', 'other'\)/);
  assert.match(sql, /add column if not exists featured_image_path text/);
});

test('featured images use a private, size-limited bucket with owner-scoped policies', () => {
  assert.match(sql, /'user-post-images',\s*'user-post-images',\s*false,\s*5242880/);
  assert.match(sql, /Authors upload post images[\s\S]*?storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)::text\)/);
  assert.match(sql, /Authors and admins read post images[\s\S]*?'super_admin'[\s\S]*?'aal2'/);
  assert.match(sql, /Authors delete post images/);
});

test('site modes remain compatible with the legacy maintenance flag', () => {
  assert.match(sql, /site_status in \('live', 'maintenance', 'offline'\)/);
  assert.match(sql, /set site_status = case when is_maintenance then 'maintenance' else 'live' end/);
  assert.match(sql, /create trigger sync_site_status_before_write/);
  assert.match(sql, /alter publication supabase_realtime add table public\.site_settings/);
});

test('audit records are private and readable only by Super Admins with MFA', () => {
  assert.match(sql, /create table if not exists public\.admin_audit_log/);
  assert.match(sql, /alter table public\.admin_audit_log enable row level security/);
  assert.match(sql, /revoke all on public\.admin_audit_log from anon, authenticated/);
  assert.match(sql, /Super admins with MFA read audit log[\s\S]*?'super_admin'[\s\S]*?'aal2'/);
  assert.match(sql, /create trigger audit_admin_post_moderation/);
  assert.match(sql, /after insert or update or delete on public\.announcements/);
  assert.match(sql, /create trigger audit_admin_support_replies/);
});

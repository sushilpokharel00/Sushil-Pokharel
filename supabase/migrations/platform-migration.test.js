import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('./20261101003814_user_platform_and_content.sql', import.meta.url);
const sql = await readFile(migrationUrl, 'utf8');

test('platform data tables enable row-level security', () => {
  for (const table of [
    'profiles',
    'user_posts',
    'announcements',
    'newsletter_subscribers',
    'newsletter_campaigns',
    'user_activity',
    'page_views',
  ]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }
});

test('site settings include editable safe metadata for the home page', () => {
  assert.match(sql, /alter table public\.site_settings[\s\S]*?add column if not exists site_name/);
  assert.match(sql, /add column if not exists site_description/);
});

test('administrator database policies require a trusted admin role and MFA', () => {
  assert.match(sql, /auth\.jwt\(\) -> 'app_metadata' ->> 'role'\) = 'admin'/);
  assert.match(sql, /auth\.jwt\(\) ->> 'aal'\) = 'aal2'/);
  assert.match(sql, /Admins manage announcements with MFA/);
  assert.match(sql, /Admins moderate posts with MFA/);
});

test('unapproved posts stay private and user edits cannot alter moderation state', () => {
  assert.match(sql, /Anyone reads approved posts[\s\S]*?status = 'approved'/);
  assert.match(sql, /Users create their own drafts[\s\S]*?status = 'draft'/);
  assert.match(sql, /Users edit their own unapproved posts[\s\S]*?moderation_note is null[\s\S]*?reviewed_at is null/);
  assert.match(sql, /Users withdraw approved posts for revision[\s\S]*?status = 'draft'/);
});

test('newsletter and analytics tables are not granted to public browser roles', () => {
  assert.match(sql, /revoke all on public\.newsletter_subscribers from anon, authenticated/i);
  assert.match(sql, /revoke all on public\.newsletter_campaigns from anon, authenticated/i);
  assert.match(sql, /revoke all on public\.page_views from anon, authenticated/i);
});

test('avatar storage is restricted by user folder, file size, and image type', () => {
  assert.match(sql, /file_size_limit, allowed_mime_types[\s\S]*?2097152, array\['image\/jpeg', 'image\/png', 'image\/webp'\]/);
  assert.match(sql, /storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)::text\)/);
});

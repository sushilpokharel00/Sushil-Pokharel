import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('./20261101010920_username_authentication.sql', import.meta.url);
const sql = await readFile(migrationUrl, 'utf8');
const platformUrl = new URL('./20261101003814_user_platform_and_content.sql', import.meta.url);
const platformSql = await readFile(platformUrl, 'utf8');

test('usernames are normalized, validated, and unique in the database', () => {
  assert.match(sql, /username = lower\(username\)/i);
  assert.match(sql, /profiles_username_format/i);
  assert.match(sql, /create unique index profiles_username_unique_idx/i);
});

test('new profile usernames come from signup metadata and remain owner-protected', () => {
  assert.match(sql, /raw_user_meta_data ->> 'username'/i);
  assert.match(sql, /grant insert \(user_id, full_name, email_notifications, avatar_path, username\)/i);
  assert.match(sql, /grant update \(user_id, full_name, email_notifications, avatar_path, username\)/i);
  assert.match(platformSql, /on public\.profiles for update to authenticated[\s\S]*?using \(\(select auth\.uid\(\)\) = user_id\)[\s\S]*?with check \(\(select auth\.uid\(\)\) = user_id\)/i);
});

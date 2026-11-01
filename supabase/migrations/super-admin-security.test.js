import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('./20261101022343_super_admin_security.sql', import.meta.url);
const sql = await readFile(migrationUrl, 'utf8');

test('replaces every privileged RLS policy with the trusted Super Admin role and MFA', () => {
  assert.match(sql, /drop policy if exists "Admins with MFA can update site settings"/);
  assert.match(sql, /drop policy if exists "Admins with MFA can reply to support requests"/);
  assert.match(sql, /drop policy if exists "Admins moderate posts with MFA"/);
  assert.match(sql, /drop policy if exists "Admins manage announcements with MFA"/);
  assert.equal((sql.match(/'super_admin'/g) ?? []).length, 11);
  assert.equal((sql.match(/'aal2'/g) ?? []).length, 11);
  assert.doesNotMatch(sql, /role'\)\s*=\s*'admin'/);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const supabaseDir = new URL('../', import.meta.url);
const migration = await readFile(new URL('migrations/20261101160253_use_subscribers_table.sql', supabaseDir), 'utf8');
const newsletterFunction = await readFile(new URL('functions/newsletter/index.ts', supabaseDir), 'utf8');
const adminFunction = await readFile(new URL('functions/admin-platform/index.ts', supabaseDir), 'utf8');

test('newsletter migration preserves data by renaming the existing table and keeps it private', () => {
  assert.match(migration, /alter table public\.newsletter_subscribers rename to subscribers/i);
  assert.match(migration, /alter table public\.subscribers enable row level security/i);
  assert.match(migration, /revoke all on public\.subscribers from anon, authenticated/i);
});

test('newsletter subscription and campaign endpoints use the private subscribers table', () => {
  assert.match(newsletterFunction, /admin\.from\('subscribers'\)/);
  assert.match(adminFunction, /\.from\('subscribers'\)/);
});

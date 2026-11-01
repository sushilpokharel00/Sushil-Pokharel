import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const sources = {
  adminEndpoint: await readFile(new URL('supabase/functions/admin-platform/index.ts', root), 'utf8'),
  adminSignIn: await readFile(new URL('supabase/functions/sign-in-with-username/index.ts', root), 'utf8'),
  routeGuard: await readFile(new URL('src/App.jsx', root), 'utf8'),
  adminPage: await readFile(new URL('src/AdminPage.jsx', root), 'utf8'),
};

test('admin backend actions require a trusted Super Admin role and verified MFA', () => {
  assert.match(sources.adminEndpoint, /user\.app_metadata\?\.role !== 'super_admin'/);
  assert.match(sources.adminEndpoint, /assurance\.currentLevel !== 'aal2'/);
});

test('admin sign-in and protected UI routes reject non-Super-Admin accounts', () => {
  assert.match(sources.adminSignIn, /purpose === 'admin' && data\.user\.app_metadata\?\.role !== 'super_admin'/);
  assert.match(sources.routeGuard, /user\.app_metadata\?\.role === 'super_admin'/);
  assert.match(sources.adminPage, /user\.app_metadata\?\.role !== 'super_admin'/);
});

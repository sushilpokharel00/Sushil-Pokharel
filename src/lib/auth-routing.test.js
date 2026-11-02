import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAuthRedirectUrl,
  getDashboardPath,
  getUsernameError,
  isPasswordRecoveryUrl,
  normalizeUsername,
} from './auth-routing.js';

test('username normalization is consistent and case-insensitive', () => {
  assert.equal(normalizeUsername('  Sushil_7  '), 'sushil_7');
});

test('username validation matches the database constraints', () => {
  assert.equal(getUsernameError('sushil_7'), '');
  assert.notEqual(getUsernameError('ab'), '');
  assert.notEqual(getUsernameError('-starts-with-dash'), '');
  assert.notEqual(getUsernameError('has space'), '');
});

test('only the trusted super-admin role opens the administrator dashboard', () => {
  assert.equal(getDashboardPath('super_admin'), '/admin/dashboard');
  assert.equal(getDashboardPath('admin'), '/user/dashboard');
  assert.equal(getDashboardPath('user'), '/user/dashboard');
  assert.equal(getDashboardPath(undefined), '/user/dashboard');
});

test('auth redirects use only the official production origin', () => {
  assert.equal(
    getAuthRedirectUrl('/reset-password', 'https://sushilpokharel00.com.np'),
    'https://sushilpokharel00.com.np/reset-password',
  );
  assert.throws(() => getAuthRedirectUrl('/reset-password', 'http://example.test'));
  assert.throws(() => getAuthRedirectUrl('/reset-password', 'https://example.com'));
  assert.throws(() => getAuthRedirectUrl('/reset-password', 'https://sushilpokharel00.com.np/path'));
});

test('password recovery links are detected in the hash or query string', () => {
  assert.equal(isPasswordRecoveryUrl({ hash: '#access_token=token&type=recovery', search: '' }), true);
  assert.equal(isPasswordRecoveryUrl({ hash: '', search: '?type=recovery' }), true);
  assert.equal(isPasswordRecoveryUrl({ hash: '#access_token=token&type=signup', search: '' }), false);
});

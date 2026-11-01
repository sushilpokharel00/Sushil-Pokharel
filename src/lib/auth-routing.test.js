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

test('dashboard routes are selected only from the trusted role value', () => {
  assert.equal(getDashboardPath('admin'), '/admin');
  assert.equal(getDashboardPath('user'), '/user');
  assert.equal(getDashboardPath(undefined), '/user');
});

test('auth redirects use the configured origin and account path', () => {
  assert.equal(
    getAuthRedirectUrl('/account', 'https://sushilpokharel00.com.np'),
    'https://sushilpokharel00.com.np/account',
  );
  assert.equal(getAuthRedirectUrl('/account', 'http://localhost:3000'), 'http://localhost:3000/account');
  assert.throws(() => getAuthRedirectUrl('/account', 'http://example.com'));
  assert.throws(() => getAuthRedirectUrl('/account', 'https://example.com/path'));
});

test('password recovery links are detected in the hash or query string', () => {
  assert.equal(isPasswordRecoveryUrl({ hash: '#access_token=token&type=recovery', search: '' }), true);
  assert.equal(isPasswordRecoveryUrl({ hash: '', search: '?type=recovery' }), true);
  assert.equal(isPasswordRecoveryUrl({ hash: '#access_token=token&type=signup', search: '' }), false);
});

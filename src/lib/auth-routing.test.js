import assert from 'node:assert/strict';
import test from 'node:test';
import { getDashboardPath, getUsernameError, normalizeUsername } from './auth-routing.js';

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

import assert from 'node:assert/strict';
import test from 'node:test';
import { getPasswordPolicyError } from './password-policy.js';

test('requires a minimum length', () => {
  assert.match(getPasswordPolicyError('Ab1!xyz'), /8 characters/);
});

test('requires all configured character classes', () => {
  assert.match(getPasswordPolicyError('password1!'), /uppercase/);
  assert.match(getPasswordPolicyError('PASSWORD1!'), /lowercase/);
  assert.match(getPasswordPolicyError('Password!'), /number/);
  assert.match(getPasswordPolicyError('Password1'), /special character/);
});

test('accepts a sufficiently strong password', () => {
  assert.equal(getPasswordPolicyError('ExamplePass1!'), '');
});

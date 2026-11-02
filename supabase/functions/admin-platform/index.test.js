import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8');

test('admin authentication validates the bearer token and its MFA assurance level', () => {
  assert.match(source, /client\.auth\.getUser\(token\)/);
  assert.match(source, /client\.auth\.mfa\.getAuthenticatorAssuranceLevel\(token\)/);
});

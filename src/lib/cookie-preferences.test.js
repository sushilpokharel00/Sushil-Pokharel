import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_COOKIE_PREFERENCES,
  parseCookiePreferences,
  serializeCookiePreferences,
} from './cookie-preferences.js';

test('cookie preferences default to essential storage only', () => {
  assert.deepEqual(DEFAULT_COOKIE_PREFERENCES, {
    essential: true,
    analytics: false,
    advertising: false,
  });
  assert.equal(parseCookiePreferences(null), null);
});

test('saved choices cannot disable essential storage', () => {
  assert.deepEqual(
    parseCookiePreferences('{"version":1,"essential":false,"analytics":true,"advertising":false}'),
    { essential: true, analytics: true, advertising: false },
  );
});

test('invalid saved preferences fail closed', () => {
  assert.equal(parseCookiePreferences('{invalid'), null);
  assert.equal(parseCookiePreferences('{"version":1,"analytics":"yes","advertising":true}'), null);
});

test('serialization stores only explicit optional choices', () => {
  assert.equal(
    serializeCookiePreferences({ analytics: true, advertising: false }),
    '{"version":1,"essential":true,"analytics":true,"advertising":false}',
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { getFunctionErrorMessage } from './function-error.js';

test('uses the message returned by a failed Edge Function', async () => {
  const error = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    context: new Response(JSON.stringify({ error: 'Newsletter service is not configured.' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    }),
  });

  assert.equal(await getFunctionErrorMessage(error, 'Request failed.'), 'Newsletter service is not configured.');
});

test('falls back to the SDK message for non-JSON function errors', async () => {
  const error = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    context: new Response('Service unavailable', { status: 503 }),
  });

  assert.equal(await getFunctionErrorMessage(error, 'Request failed.'), 'Edge Function returned a non-2xx status code');
});

test('uses the fallback when the error has no message', async () => {
  assert.equal(await getFunctionErrorMessage({}, 'Request failed.'), 'Request failed.');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { listSupportRequests, replyToSupportRequest } from './support-inbox.js';

const config = {
  supabaseUrl: 'https://example-project.supabase.co',
  serviceRoleKey: 'private-service-role-key',
};

function jsonResponse(status, value) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => value,
  };
}

const request = {
  id: '6fded093-9627-4e8b-b68e-3d5f90dfad41',
  user_id: 'fc6e5a5f-5d64-4d4b-a3d9-32e203d56a6e',
  requester_email: 'requester@example.com',
  subject: 'Help, please',
  message: 'I need assistance.',
  admin_reply: null,
  created_at: '2026-10-10T12:00:00Z',
  replied_at: null,
};

test('lists the newest support requests without exposing the service-role key', async () => {
  let requestUrl;
  let requestOptions;
  const result = await listSupportRequests(config, async (url, options) => {
    requestUrl = new URL(url);
    requestOptions = options;
    return jsonResponse(200, [request]);
  });

  assert.equal(requestUrl.pathname, '/rest/v1/support_requests');
  assert.equal(requestUrl.searchParams.get('limit'), '100');
  assert.equal(requestUrl.searchParams.get('order'), 'created_at.desc');
  assert.equal(requestOptions.headers.apikey, config.serviceRoleKey);
  assert.equal(result.requests.length, 1);
  assert.equal(JSON.stringify(result).includes(config.serviceRoleKey), false);
});

test('replies to a support request and validates input before requesting Supabase', async () => {
  let requestUrl;
  let requestBody;
  const result = await replyToSupportRequest({
    requestId: request.id,
    reply: '  We can help with that.  ',
  }, config, async (url, options) => {
    requestUrl = new URL(url);
    requestBody = JSON.parse(options.body);
    return jsonResponse(200, [{
      ...request,
      admin_reply: requestBody.admin_reply,
      replied_at: requestBody.replied_at,
    }]);
  });

  assert.equal(requestUrl.searchParams.get('id'), `eq.${request.id}`);
  assert.equal(requestBody.admin_reply, 'We can help with that.');
  assert.equal(typeof requestBody.replied_at, 'string');
  assert.equal(result.updated, true);
  assert.equal(result.request.admin_reply, 'We can help with that.');

  await assert.rejects(
    replyToSupportRequest({ requestId: 'bad-id', reply: 'Hello' }, config),
    /valid UUID/,
  );
  await assert.rejects(
    replyToSupportRequest({ requestId: request.id, reply: '  ' }, config),
    /between 1 and 3000 characters/,
  );
});

test('requires trusted MCP configuration and rejects redirects', async () => {
  await assert.rejects(listSupportRequests({
    supabaseUrl: config.supabaseUrl,
    serviceRoleKey: '',
  }), /SUPABASE_SERVICE_ROLE_KEY/);

  await assert.rejects(
    listSupportRequests(config, async () => jsonResponse(307, {})),
    /redirects are not allowed/,
  );
});

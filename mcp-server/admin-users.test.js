import assert from 'node:assert/strict';
import test from 'node:test';
import { grantSiteAdmin } from './admin-users.js';

const config = {
  supabaseUrl: 'https://example-project.supabase.co',
  serviceRoleKey: 'local-test-service-role-key',
};
const verifiedAdminCandidate = {
  id: 'user-123',
  email: 'admin@example.com',
  email_confirmed_at: '2026-10-08T12:00:00Z',
  app_metadata: { provider: 'email', role: 'user' },
  factors: [{ factor_type: 'totp', status: 'verified' }],
};

function jsonResponse(status, value) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => value,
  };
}

test('grants admin to a confirmed MFA account and preserves existing app metadata', async () => {
  const requests = [];
  const result = await grantSiteAdmin({
    email: 'ADMIN@example.com',
    confirmationEmail: 'admin@example.com',
  }, config, async (url, options) => {
    requests.push({ url: new URL(url), options });
    if (options.method === 'PUT') {
      return jsonResponse(200, {
        user: {
          id: verifiedAdminCandidate.id,
          email: verifiedAdminCandidate.email,
          app_metadata: { provider: 'email', role: 'admin' },
        },
      });
    }
    return jsonResponse(200, { users: [verifiedAdminCandidate] });
  });

  assert.equal(requests[0].url.pathname, '/auth/v1/admin/users');
  assert.equal(requests[0].options.redirect, 'manual');
  assert.equal(requests[1].options.method, 'PUT');
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    app_metadata: { provider: 'email', role: 'admin' },
  });
  assert.equal(result.updated, true);
  assert.equal(result.role, 'admin');
  assert.equal(JSON.stringify(result).includes(config.serviceRoleKey), false);
});

test('requires explicit matching email confirmation before searching Supabase', async () => {
  await assert.rejects(
    grantSiteAdmin({
      email: 'admin@example.com',
      confirmationEmail: 'different@example.com',
    }, config, async () => {
      throw new Error('fetch must not be called');
    }),
    /must exactly match email/,
  );
});

test('does not promote unconfirmed accounts', async () => {
  await assert.rejects(
    grantSiteAdmin({
      email: 'admin@example.com',
      confirmationEmail: 'admin@example.com',
    }, config, async () => jsonResponse(200, {
      users: [{ ...verifiedAdminCandidate, email_confirmed_at: null, confirmed_at: null }],
    })),
    /Confirm this account email/,
  );
});

test('does not promote accounts without verified TOTP', async () => {
  await assert.rejects(
    grantSiteAdmin({
      email: 'admin@example.com',
      confirmationEmail: 'admin@example.com',
    }, config, async () => jsonResponse(200, {
      users: [{ ...verifiedAdminCandidate, factors: [] }],
    })),
    /enroll and verify an authenticator/,
  );
});

test('requires a local service-role key and rejects non-Supabase hosts', async () => {
  await assert.rejects(
    grantSiteAdmin({
      email: 'admin@example.com',
      confirmationEmail: 'admin@example.com',
    }, { supabaseUrl: config.supabaseUrl, serviceRoleKey: '' }),
    /SUPABASE_SERVICE_ROLE_KEY/,
  );
  await assert.rejects(
    grantSiteAdmin({
      email: 'admin@example.com',
      confirmationEmail: 'admin@example.com',
    }, { ...config, supabaseUrl: 'https://attacker.example' }),
    /HTTPS Supabase project URL/,
  );
});

test('rejects redirects on privileged Supabase Auth requests', async () => {
  await assert.rejects(
    grantSiteAdmin({
      email: 'admin@example.com',
      confirmationEmail: 'admin@example.com',
    }, config, async () => jsonResponse(307, {})),
    /redirects are not allowed/,
  );
});

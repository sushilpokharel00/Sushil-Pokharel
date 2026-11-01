import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SUPER_ADMIN_EMAIL,
  seedSuperAdmin,
} from './super-admin-seeder.js';

const environment = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  SUPER_ADMIN_PASSWORD: 'Strong-Passphrase-2030!',
};

function makeAdminClient({ users = [], createError = null } = {}) {
  const calls = { list: [], create: [], update: [] };
  const client = {
    auth: {
      admin: {
        async listUsers(options) {
          calls.list.push(options);
          return { data: { users }, error: null };
        },
        async createUser(input) {
          calls.create.push(input);
          return {
            data: { user: createError ? null : { id: 'seeded-id', email: input.email } },
            error: createError,
          };
        },
        async updateUserById(id, input) {
          calls.update.push({ id, input });
          return { error: null };
        },
      },
    },
  };
  return { client, calls };
}

test('creates the configured Super Admin through Supabase Auth with a strong secret password', async () => {
  const { client, calls } = makeAdminClient();
  const result = await seedSuperAdmin(environment, (url, key) => {
    assert.equal(url, environment.SUPABASE_URL);
    assert.equal(key, environment.SUPABASE_SERVICE_ROLE_KEY);
    return client;
  });

  assert.equal(result.action, 'created');
  assert.equal(result.email, DEFAULT_SUPER_ADMIN_EMAIL);
  assert.deepEqual(calls.create, [{
    email: DEFAULT_SUPER_ADMIN_EMAIL,
    password: environment.SUPER_ADMIN_PASSWORD,
    email_confirm: true,
    app_metadata: { role: 'super_admin' },
  }]);
  assert.equal(calls.update.length, 0);
});

test('promotes an existing confirmed account without changing its password or other app metadata', async () => {
  const { client, calls } = makeAdminClient({
    users: [{
      id: 'existing-id',
      email: DEFAULT_SUPER_ADMIN_EMAIL.toUpperCase(),
      email_confirmed_at: '2026-10-01T00:00:00Z',
      app_metadata: { provider: 'email', custom: 'preserved', role: 'admin' },
    }],
  });

  const result = await seedSuperAdmin({
    ...environment,
    SUPER_ADMIN_PASSWORD: undefined,
  }, () => client);

  assert.equal(result.action, 'promoted');
  assert.deepEqual(calls.update, [{
    id: 'existing-id',
    input: {
      app_metadata: { provider: 'email', custom: 'preserved', role: 'super_admin' },
    },
  }]);
  assert.equal(calls.create.length, 0);
});

test('does not mutate an account that already has the Super Admin role', async () => {
  const { client, calls } = makeAdminClient({
    users: [{
      id: 'existing-id',
      email: DEFAULT_SUPER_ADMIN_EMAIL,
      email_confirmed_at: '2026-10-01T00:00:00Z',
      app_metadata: { role: 'super_admin' },
    }],
  });

  const result = await seedSuperAdmin(environment, () => client);
  assert.equal(result.action, 'unchanged');
  assert.equal(calls.create.length, 0);
  assert.equal(calls.update.length, 0);
});

test('requires a strong password only when creating the initial account', async () => {
  const { client, calls } = makeAdminClient();
  await assert.rejects(
    seedSuperAdmin({
      ...environment,
      SUPER_ADMIN_PASSWORD: 'short',
    }, () => client),
    /at least 16 characters/,
  );
  assert.equal(calls.create.length, 0);
});

test('does not promote an unconfirmed existing account', async () => {
  const { client, calls } = makeAdminClient({
    users: [{
      id: 'existing-id',
      email: DEFAULT_SUPER_ADMIN_EMAIL,
      app_metadata: {},
    }],
  });
  await assert.rejects(seedSuperAdmin(environment, () => client), /email must be confirmed/);
  assert.equal(calls.update.length, 0);
});

test('requires a trusted project URL and server-only service role key', async () => {
  const { client } = makeAdminClient();
  await assert.rejects(
    seedSuperAdmin({ ...environment, SUPABASE_URL: 'https://example.com' }, () => client),
    /HTTPS Supabase project URL/,
  );
  await assert.rejects(
    seedSuperAdmin({ ...environment, SUPABASE_SERVICE_ROLE_KEY: '' }, () => client),
    /SUPABASE_SERVICE_ROLE_KEY/,
  );
});

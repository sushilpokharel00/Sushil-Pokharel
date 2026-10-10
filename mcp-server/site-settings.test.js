import assert from 'node:assert/strict';
import test from 'node:test';
import { checkSiteStorage, readSiteSettings, updateSiteSettings } from './site-settings.js';

const config = {
  supabaseUrl: 'https://example-project.supabase.co',
  supabaseAnonKey: 'public-anon-key',
  serviceRoleKey: 'private-service-role-key',
};

function jsonResponse(status, value) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => value,
  };
}

const row = {
  id: 1,
  is_maintenance: false,
  maintenance_title: 'We are open',
  maintenance_message: 'Welcome back.',
  support_online: true,
  updated_at: '2026-10-08T12:00:00Z',
};

test('reads website settings using the public key and never returns credentials', async () => {
  let requestUrl;
  let requestOptions;
  const result = await readSiteSettings(config, async (url, options) => {
    requestUrl = new URL(url);
    requestOptions = options;
    return jsonResponse(200, [row]);
  });

  assert.equal(requestUrl.pathname, '/rest/v1/site_settings');
  assert.equal(requestUrl.searchParams.get('id'), 'eq.1');
  assert.equal(requestOptions.method, 'GET');
  assert.equal(requestOptions.headers.apikey, config.supabaseAnonKey);
  assert.equal(requestOptions.redirect, 'manual');
  assert.deepEqual(result.settings, {
    isMaintenance: false,
    title: 'We are open',
    message: 'Welcome back.',
    supportOnline: true,
    updatedAt: row.updated_at,
  });
  assert.equal(JSON.stringify(result).includes(config.supabaseAnonKey), false);
});

test('reports a missing table row and migration guidance', async () => {
  const result = await readSiteSettings(config, async () => jsonResponse(200, []));
  assert.equal(result.storage, 'supabase');
  assert.equal(result.found, false);
  assert.match(result.recommendation, /migration/);
});

test('reports Supabase configuration and storage readiness without exposing secrets', async () => {
  const result = await checkSiteStorage(config, async () => jsonResponse(200, [row]));
  assert.equal(result.configured, true);
  assert.equal(result.storageReady, true);
  assert.equal(result.migrationApplied, true);
  assert.equal(typeof result.mcpWriteToolsConfigured, 'boolean');

  const missingConfig = await checkSiteStorage({
    supabaseUrl: '',
    supabaseAnonKey: '',
  });
  assert.equal(missingConfig.configured, false);
  assert.equal(missingConfig.storageReady, false);
  assert.equal(missingConfig.migrationApplied, null);
  assert.match(missingConfig.recommendation, /\.env/);
});

test('requires local public storage configuration', async () => {
  await assert.rejects(
    readSiteSettings({ supabaseUrl: config.supabaseUrl, supabaseAnonKey: '' }),
    /SUPABASE_ANON_KEY/,
  );
  await assert.rejects(readSiteSettings({ supabaseAnonKey: config.supabaseAnonKey }), /SUPABASE_URL/);
});

test('rejects non-Supabase hosts before making authenticated requests', async () => {
  await assert.rejects(
    readSiteSettings({
      ...config,
      supabaseUrl: 'https://attacker.example',
    }, async () => {
      throw new Error('fetch must not be called');
    }),
    /HTTPS Supabase project URL/,
  );
});

test('reports missing migration and rejected public access', async () => {
  await assert.rejects(readSiteSettings(config, async () => jsonResponse(404, {})), /Apply the site settings migration/);
  await assert.rejects(readSiteSettings(config, async () => jsonResponse(403, {})), /table policy/);
});

test('updates site settings with the local service-role key without returning it', async () => {
  let requestOptions;
  const result = await updateSiteSettings({
    isMaintenance: true,
    title: 'Planned maintenance',
    message: 'Back soon.',
  }, {
    supabaseUrl: config.supabaseUrl,
    serviceRoleKey: config.serviceRoleKey,
  }, async (_url, options) => {
    requestOptions = options;
    return jsonResponse(200, [{
      ...row,
      is_maintenance: true,
      maintenance_title: 'Planned maintenance',
      maintenance_message: 'Back soon.',
      support_online: false,
    }]);
  });

  assert.equal(requestOptions.method, 'PATCH');
  assert.equal(requestOptions.redirect, 'manual');
  assert.equal(requestOptions.headers.apikey, config.serviceRoleKey);
  assert.equal(requestOptions.headers.authorization, `Bearer ${config.serviceRoleKey}`);
  assert.deepEqual(JSON.parse(requestOptions.body), {
    is_maintenance: true,
    maintenance_title: 'Planned maintenance',
    maintenance_message: 'Back soon.',
  });
  assert.equal(result.updated, true);
  assert.equal(result.settings.title, 'Planned maintenance');
  assert.equal(result.settings.supportOnline, false);
  assert.equal(JSON.stringify(result).includes(config.serviceRoleKey), false);
});

test('updates support availability when requested', async () => {
  let requestBody;
  await updateSiteSettings({
    isMaintenance: false,
    title: 'Open',
    message: 'Welcome.',
    supportOnline: true,
  }, {
    supabaseUrl: config.supabaseUrl,
    serviceRoleKey: config.serviceRoleKey,
  }, async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return jsonResponse(200, [{ ...row, support_online: true }]);
  });
  assert.equal(requestBody.support_online, true);
});

test('requires a local service-role key for storage updates', async () => {
  await assert.rejects(
    updateSiteSettings({
      isMaintenance: true,
      title: 'Maintenance',
      message: 'Back soon.',
    }, {
      supabaseUrl: config.supabaseUrl,
      serviceRoleKey: '',
    }),
    /SUPABASE_SERVICE_ROLE_KEY/,
  );
});

test('validates update fields before requesting Supabase', async () => {
  await assert.rejects(
    updateSiteSettings({
      isMaintenance: true,
      title: '   ',
      message: 'Back soon.',
    }, {
      supabaseUrl: config.supabaseUrl,
      serviceRoleKey: config.serviceRoleKey,
    }, async () => {
      throw new Error('fetch must not be called');
    }),
    /title must contain/,
  );
});

test('rejects Supabase redirects on privileged calls', async () => {
  await assert.rejects(
    updateSiteSettings({
      isMaintenance: true,
      title: 'Maintenance',
      message: 'Back soon.',
    }, {
      supabaseUrl: config.supabaseUrl,
      serviceRoleKey: config.serviceRoleKey,
    }, async () => jsonResponse(307, {})),
    /redirects are not allowed/,
  );
});

test('fails explicitly if no site-settings row exists for an update', async () => {
  await assert.rejects(
    updateSiteSettings({
      isMaintenance: true,
      title: 'Maintenance',
      message: 'Back soon.',
    }, {
      supabaseUrl: config.supabaseUrl,
      serviceRoleKey: config.serviceRoleKey,
    }, async () => jsonResponse(200, [])),
    /No site settings row was updated/,
  );
});
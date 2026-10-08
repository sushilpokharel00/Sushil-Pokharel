import './load-env.js';

const settingsFields = 'id,is_maintenance,maintenance_title,maintenance_message,updated_at';
const requestTimeoutMs = 10_000;

export class SiteSettingsError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SiteSettingsError';
    this.code = code;
  }
}

function getSupabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new SiteSettingsError('configuration_missing', 'Set SUPABASE_URL to your Supabase project URL.');
  }

  if (
    url.protocol !== 'https:' ||
    !/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new SiteSettingsError('configuration_invalid', 'SUPABASE_URL must be an HTTPS Supabase project URL such as https://your-project.supabase.co.');
  }

  return url;
}

function getRow(rows) {
  if (!Array.isArray(rows) || rows.length > 1) {
    throw new Error('Supabase returned an unexpected site settings response.');
  }

  if (rows.length === 0) return null;
  const [row] = rows;
  if (
    row.id !== 1 ||
    typeof row.is_maintenance !== 'boolean' ||
    typeof row.maintenance_title !== 'string' ||
    typeof row.maintenance_message !== 'string' ||
    typeof row.updated_at !== 'string'
  ) {
    throw new Error('Supabase returned invalid site settings data.');
  }
  return row;
}

function toPublicResult(row) {
  if (!row) {
    return {
      configured: true,
      storage: 'supabase',
      found: false,
      settings: null,
      recommendation: 'Apply the site settings migration to create the default public settings row.',
    };
  }

  return {
    configured: true,
    storage: 'supabase',
    found: true,
    settings: {
      isMaintenance: row.is_maintenance,
      title: row.maintenance_title,
      message: row.maintenance_message,
      updatedAt: row.updated_at,
    },
    recommendation: 'Site settings are stored in Supabase. Use the local MCP update tool or MFA-protected website admin dashboard to change them.',
  };
}

function getProjectConfiguration({
  supabaseUrl = process.env.SUPABASE_URL,
  supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY,
} = {}) {
  if (typeof supabaseAnonKey !== 'string' || !supabaseAnonKey.trim()) {
    throw new SiteSettingsError('configuration_missing', 'Set SUPABASE_ANON_KEY in the local MCP server environment to the Supabase public anon/publishable key.');
  }

  return {
    projectUrl: getSupabaseUrl(supabaseUrl),
    apiKey: supabaseAnonKey.trim(),
    bearerKey: supabaseAnonKey.trim(),
  };
}

async function requestRows({ projectUrl, apiKey, bearerKey, method, body, fetchImpl }) {
  const endpoint = new URL('/rest/v1/site_settings', projectUrl);
  endpoint.searchParams.set('id', 'eq.1');
  endpoint.searchParams.set('select', settingsFields);

  const headers = {
    accept: 'application/json',
    apikey: apiKey,
    authorization: `Bearer ${bearerKey}`,
  };
  if (body) {
    headers['content-type'] = 'application/json';
    headers.prefer = 'return=representation';
  }

  const response = await fetchImpl(endpoint, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: 'manual',
    signal: AbortSignal.timeout(requestTimeoutMs),
  });

  if (response.status >= 300 && response.status < 400) {
    throw new SiteSettingsError('redirect_rejected', 'Supabase redirected a storage request; redirects are not allowed for authenticated calls.');
  }
  if (!response.ok) {
    if (response.status === 404) {
      throw new SiteSettingsError('migration_missing', 'Supabase site_settings table was not found. Apply the site settings migration in the Supabase SQL Editor.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new SiteSettingsError('access_rejected', `Supabase rejected the project key or table policy (HTTP ${response.status}). Check MCP credentials and site_settings permissions.`);
    }
    throw new SiteSettingsError('storage_unavailable', `Could not ${method === 'GET' ? 'read' : 'update'} site settings in Supabase (HTTP ${response.status}).`);
  }

  return response.json();
}

export async function readSiteSettings(config = {}, fetchImpl = fetch) {
  const project = getProjectConfiguration(config);
  const rows = await requestRows({
    ...project,
    method: 'GET',
    fetchImpl,
  });
  return toPublicResult(getRow(rows));
}

export async function checkSiteStorage(config = {}, fetchImpl = fetch) {
  const env = {
    supabaseUrl: config.supabaseUrl ?? process.env.SUPABASE_URL,
    supabaseAnonKey: config.supabaseAnonKey
      ?? process.env.SUPABASE_ANON_KEY
      ?? process.env.VITE_SUPABASE_ANON_KEY,
  };
  const mcpWriteToolsConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  try {
    const result = await readSiteSettings(env, fetchImpl);
    return {
      ...result,
      storageReady: result.found,
      migrationApplied: true,
      mcpWriteToolsConfigured,
    };
  } catch (error) {
    if (!(error instanceof SiteSettingsError)) throw error;
    return {
      configured: error.code !== 'configuration_missing' && error.code !== 'configuration_invalid',
      storage: 'supabase',
      storageReady: false,
      migrationApplied: error.code === 'migration_missing' ? false : null,
      mcpWriteToolsConfigured,
      error: {
        code: error.code,
        message: error.message,
      },
      recommendation: error.code === 'configuration_missing'
        ? 'Copy .env.example to .env and set SUPABASE_URL and SUPABASE_ANON_KEY for this local MCP server.'
        : error.code === 'configuration_invalid'
          ? 'Use the HTTPS project URL and public anon/publishable key from your Supabase project settings.'
          : error.code === 'migration_missing'
            ? 'Apply supabase/migrations/20261008000000_site_settings.sql in the Supabase SQL Editor.'
            : 'Check the Supabase project, local MCP environment, and public site_settings read permissions.',
    };
  }
}

export async function updateSiteSettings(
  { isMaintenance, title, message },
  {
    supabaseUrl = process.env.SUPABASE_URL,
    serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
  } = {},
  fetchImpl = fetch,
) {
  const projectUrl = getSupabaseUrl(supabaseUrl);
  if (typeof serviceRoleKey !== 'string' || !serviceRoleKey.trim()) {
    throw new SiteSettingsError('write_key_missing', 'Set SUPABASE_SERVICE_ROLE_KEY in the trusted local MCP server environment to enable storage updates.');
  }
  if (typeof isMaintenance !== 'boolean') {
    throw new TypeError('isMaintenance must be true or false.');
  }
  if (typeof title !== 'string' || title.trim().length < 1 || title.trim().length > 120) {
    throw new TypeError('title must contain between 1 and 120 characters.');
  }
  if (typeof message !== 'string' || message.trim().length < 1 || message.trim().length > 500) {
    throw new TypeError('message must contain between 1 and 500 characters.');
  }

  const key = serviceRoleKey.trim();
  const rows = await requestRows({
    projectUrl,
    apiKey: key,
    bearerKey: key,
    method: 'PATCH',
    body: {
      is_maintenance: isMaintenance,
      maintenance_title: title.trim(),
      maintenance_message: message.trim(),
    },
    fetchImpl,
  });
  const row = getRow(rows);
  if (!row) {
    throw new Error('No site settings row was updated. Apply the site settings migration and create its default row first.');
  }

  return {
    configured: true,
    storage: 'supabase',
    updated: true,
    settings: {
      isMaintenance: row.is_maintenance,
      title: row.maintenance_title,
      message: row.maintenance_message,
      updatedAt: row.updated_at,
    },
  };
}